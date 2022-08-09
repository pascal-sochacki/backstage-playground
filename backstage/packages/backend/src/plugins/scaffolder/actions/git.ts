import {CreateBuiltInActionsOptions, createTemplateAction} from "@backstage/plugin-scaffolder-backend";
import {Git} from "@backstage/backend-common";
import fs from "fs";

export function commitAndPush(options: CreateBuiltInActionsOptions) {
    return createTemplateAction<{
        url: string
    }>({
        id: 'mycompany:git:checkout',
        schema: {
            input: {
                required: ['url'],
                type: 'object',
                properties: {
                    contents: {
                        type: 'string',
                        title: 'Url',
                        description: 'The url to clone',
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

            const path = ctx.workspacePath + "/test";
            await fs.mkdirSync(path)
            fs.appendFileSync(path + "/deployment.yaml", "yolo")

            await git.add({dir: ctx.workspacePath, filepath: "test/deployment.yaml"})
            await git.commit({
                author: {email: "test@test.de", name: "test"},
                committer: {email: "test@test.de", name: "test"},
                message: "Add Deployment",
                dir: ctx.workspacePath,
            })
            await git.push({
                dir: ctx.workspacePath,
                remote: "origin"
            })
        }
    })
}