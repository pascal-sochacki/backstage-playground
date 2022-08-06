import {createTemplateAction} from '@backstage/plugin-scaffolder-backend';
import k8s from "@kubernetes/client-node";

export const kubectlAction = () => {
    return createTemplateAction<{ contents: string; filename: string }>({
        id: 'mycompany:kubectl',
        schema: {
        },
        async handler() {
            const kc = new k8s.KubeConfig();
            kc.loadFromDefault();

            const k8sApi = kc.makeApiClient(k8s.CoreV1Api);

            k8sApi.listNamespacedPod('default').then((res) => {
                console.log(res.body);
            });
        },
    });
}