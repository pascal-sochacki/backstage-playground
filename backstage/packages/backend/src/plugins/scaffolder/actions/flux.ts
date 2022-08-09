import {CreateBuiltInActionsOptions, createTemplateAction} from "@backstage/plugin-scaffolder-backend";
import {Git} from "@backstage/backend-common";
import fs from "fs";

export function addNamespace(options: CreateBuiltInActionsOptions) {
    return createTemplateAction<{
        url: string,
        ns: string
    }>({
        id: 'mycompany:flux:create-namespace',
        schema: {
            input: {
                required: ['url', 'ns'],
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

            await git.add({dir: ctx.workspacePath, filepath: ctx.input.ns})
            await git.commit({
                author: {email: "test@test.de", name: "test"},
                committer: {email: "test@test.de", name: "test"},
                message: `Add Namespace ${ctx.input.ns}`,
                dir: ctx.workspacePath,
            })
            await git.push({
                dir: ctx.workspacePath,
                remote: "origin"
            })
        }
    })
}

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
            fs.appendFileSync(path + "/deployment.yaml",
`apiVersion: apps/v1
kind: Deployment
metadata:
  labels:
    app: ${ctx.input.repo.repo.toLowerCase()}
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
    spec:
      containers:
      - image: ghcr.io/${ ctx.input.repo.owner.toLowerCase() }/${ ctx.input.repo.repo.toLowerCase() }:main
        name: ${ctx.input.repo.repo.toLowerCase()}`)

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