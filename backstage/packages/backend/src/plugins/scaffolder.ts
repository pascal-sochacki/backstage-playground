import { CatalogClient } from '@backstage/catalog-client';
import {createBuiltinActions, createRouter} from '@backstage/plugin-scaffolder-backend';
import { ScmIntegrations } from '@backstage/integration';
import { Router } from 'express';
import type { PluginEnvironment } from '../types';
import {kubectlAction} from "./scaffolder/actions/kubectl";
import {commitAndPush} from "./scaffolder/actions/git";
import {addDeployment} from "./scaffolder/actions/flux";

export default async function createPlugin(
  env: PluginEnvironment,
): Promise<Router> {
  const catalogClient = new CatalogClient({ discoveryApi: env.discovery });
  const integrations = ScmIntegrations.fromConfig(env.config);

  const options = {
    integrations,
    catalogClient,
    config: env.config,
    reader: env.reader,
  };
  const builtInActions = createBuiltinActions(options);

  const actions = [
      ...builtInActions,
    kubectlAction(),
    addDeployment(options),
    commitAndPush(options),
  ];

  return await createRouter({
    actions,
    logger: env.logger,
    config: env.config,
    database: env.database,
    reader: env.reader,
    catalogClient,
  });
}
