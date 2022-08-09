import { createTemplateAction} from '@backstage/plugin-scaffolder-backend';
import {KubeConfig, CoreV1Api} from "@kubernetes/client-node";
import {Config} from "@backstage/config";

export function kubectlAction(options: { config: Config }) {
    return createTemplateAction<{}>({
        id: 'mycompany:kubectl',
        async handler(ctx) {
            const kc = new KubeConfig();
            kc.loadFromDefault();

            const k8sApi = kc.makeApiClient(CoreV1Api);

            k8sApi.listNamespacedPod('default').then((res) => {
                ctx.logger.log("info", JSON.stringify(res.body.items))
            });
        },
    });
}