import {CreateBuiltInActionsOptions, createTemplateAction} from "@backstage/plugin-scaffolder-backend";
import {Git} from "@backstage/backend-common";
import fs from "fs";

export function addDeployment(options: CreateBuiltInActionsOptions) {
    return createTemplateAction<{
        url: string,
        ns: string,
        repo: {
            repo: string
            owner: string
        }
    }>({
        id: 'mycompany:flux:create-deployment',
        schema: {
            input: {
                required: ['url', 'ns', 'repo'],
                type: 'object',
                properties: {
                    url: {
                        type: 'string',
                        title: 'Url',
                        description: 'The url to clone',
                    },
                    ns: {
                        type: 'string',
                        title: 'Namespace',
                        description: 'The namespace to create',
                    },
                    repo: {
                        type: 'object',
                        title: 'Repository',
                        description: 'The Repository to deploy',
                    },
                }
            }
        },
        async handler(ctx) {
            const token = options.integrations.github.byHost("github.com")?.config.token;
            const git = Git.fromAuth({
                username: token,
                logger: ctx.logger
            });
            await git.clone({
                url: ctx.input.url,
                dir: ctx.workspacePath
            })

            const path = ctx.workspacePath + "/" + ctx.input.ns;
            await fs.mkdirSync(path)

            fs.appendFileSync(path + "/ns.yaml",
              `apiVersion: v1
kind: Namespace
metadata:
  name: ${ctx.input.ns.toLowerCase()}`)

            fs.appendFileSync(path + "/deployment.yaml",
`apiVersion: apps/v1
kind: Deployment
metadata:
  labels:
    app: ${ctx.input.repo.repo.toLowerCase()}
    backstage.io/kubernetes-id: ${ctx.input.repo.repo.toLowerCase()}
  name: ${ctx.input.repo.repo.toLowerCase()}
  namespace: ${ctx.input.ns.toLowerCase()}
spec:
  replicas: 1
  selector:
    matchLabels:
      app: ${ctx.input.repo.repo.toLowerCase()}
  template:
    metadata:
      labels:
        app: ${ctx.input.repo.repo.toLowerCase()}
        backstage.io/kubernetes-id: ${ctx.input.repo.repo.toLowerCase()}
    spec:
      imagePullSecrets:
      - name: github
      containers:
      - image: ghcr.io/${ ctx.input.repo.owner.toLowerCase() }/${ ctx.input.repo.repo.toLowerCase() }:main
        name: ${ctx.input.repo.repo.toLowerCase()}`)

            fs.appendFileSync(path + "/pull-secret.yaml",
              `apiVersion: bitnami.com/v1alpha1
kind: SealedSecret
metadata:
  annotations:
    sealedsecrets.bitnami.com/cluster-wide: "true"
  creationTimestamp: null
  name: github
  namespace: ${ctx.input.ns}
spec:
  encryptedData:
    .dockerconfigjson: AgABoq25k+1idh02tRN3WpTb2fbDvbm/wjnAAm+AlBwvDX4wj0hs8JJaq1eIMQcqdQn5lyH9vbNaYg4mx+cOLupIWZZ6ZD6rL5rOG9BIkDb9XyUfO1ZZcqTpnE32y4bTIV4UUmcf6QlZ3rWljpTK3fELTVQ38WitLMTopWu/staX6lt+K6MLskyH05+NLs3vvVBGRPGw3Uf4TscBwzB6ydXx3dR33edpl4nmM61aLS9svSe1TMlglXZ1GScq8eZbAoUCAHU3epKcgWfTLktXkzHQctWirXcp/jYRpkpjUyPyDUrS8n7Fus7Qq7pHaJOp3oz4Ef+VML0hE0AGRKUilQCehs0k07qyGLvrTATv+BpzxB9QN5luwzvjnZNjtXLxH3rOp44tnY8+AJJ54+hAAbzaq+UpVdAbanaYxlIgdcDNc6Ahs7rtROj6iE0XoXcbz/hFuKVZ5Gjptf8A7OoPOKcDCseRz5R1gIyc3SJVizkRnnCrdk0iWVkQspSFqCIgbzldBVwzjjnSHbY0g9sS7DrOiabYdH0NhlybEGnYDJdlflY4XkfCD6R9j5xbrTtbkiKeozAeKKnRTvu2XBlDZGZ76T0cIcJMXhhSMNQpDZG4K20LrI/NojITKyBXms8tLP5kfygLx4Q0DOIHk+zxL6dg6lcTSI1MbpK+yqa4nkiG3f4EBmg5M8YSAfVWI4kpihHXPRSwSKEphlLoqqs7xaQL/MYVAOD7jRswCkLBh+0BdS0Fti8dNRYXkrssLtSFNzuHc6R5OXAV9lhE+1OM/UKWT1gGN0yJ+GSMaEgndxuHYCYd+xaCrvQh9OobKpQbmDaoru7TtcG2nPWf6khKhB+VDz8+P6wEkXrxTgnjhxOXgAK9GnIbrY79rrY/5As42Y9apue64uM+p/mF25M8tmKff4AfL+6vKf8I7cxwrW2NyP2+JnFjD/Rx0Uivm6/9v2s=
  template:
    data: null
    metadata:
      annotations:
        sealedsecrets.bitnami.com/cluster-wide: "true"
      creationTimestamp: null
      name: github
      namespace: ${ctx.input.ns}
    type: kubernetes.io/dockerconfigjson

`)

            await git.add({dir: ctx.workspacePath, filepath: ctx.input.ns})
            await git.commit({
                author: {email: "test@test.de", name: "test"},
                committer: {email: "test@test.de", name: "test"},
                // @ts-ignore
                message: `Add Deployment ${ctx.input.repo.repo} to Namespace ${ctx.input.ns}`,
                dir: ctx.workspacePath,
            })
            await git.push({
                dir: ctx.workspacePath,
                remote: "origin"
            })
        }
    })
}