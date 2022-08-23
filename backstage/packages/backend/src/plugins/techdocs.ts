import {
  createRouter,
  GeneratorBase,
  GeneratorRunOptions,
  Generators,
  Preparers,
  Publisher,
} from '@backstage/plugin-techdocs-backend';
import Docker from 'dockerode';
import { Router } from 'express';
import { PluginEnvironment } from '../types';
import { PassThrough } from 'stream';
import fs from "fs";
import {ContainerRunner, RunContainerOptions} from "@backstage/backend-common";

export default async function createPlugin(
  env: PluginEnvironment,
): Promise<Router> {
  // Preparers are responsible for fetching source files for documentation.
  const preparers = await Preparers.fromConfig(env.config, {
    logger: env.logger,
    reader: env.reader,
  });

  // Docker client (conditionally) used by the generators, based on techdocs.generators config.
  const dockerClient = new Docker();

  const containerRunner = new DockerContainerRunner({ dockerClient });

  // Generators are used for generating documentation sites.

  const generators = new Generators();
  generators.register("techdocs", new test(containerRunner));


  // Publisher is used for
  // 1. Publishing generated files to storage
  // 2. Fetching files from storage and passing them to TechDocs frontend.
  const publisher = await Publisher.fromConfig(env.config, {
    logger: env.logger,
    discovery: env.discovery,
  });

  // checks if the publisher is working and logs the result
  await publisher.getReadiness();

  return await createRouter({
    preparers,
    generators,
    publisher,
    logger: env.logger,
    config: env.config,
    discovery: env.discovery,
    cache: env.cache,
  });
}

class test implements GeneratorBase {
  private containerRunner: DockerContainerRunner;

  constructor(containerRunner: DockerContainerRunner) {
    this.containerRunner = containerRunner;
  }
  async run(options: GeneratorRunOptions): Promise<void> {
    const {
      inputDir,
      outputDir,
      logger: childLogger,
      logStream,
    } = options;

    // Do some updates to mkdocs.yml before generating docs e.g. adding repo_url

    // Directories to bind on container
    const mountDirs = {
      [inputDir]: '/input',
      [outputDir]: '/output',
    };

    childLogger.info(inputDir)
    childLogger.info(outputDir)

    await this.containerRunner.runContainer({
      imageName: "busybox",
      args: ['ls'],
      logStream,
      mountDirs,
      workingDir: '/',
      // Set the home directory inside the container as something that applications can
      // write to, otherwise they will just fail trying to write to /
      envVars: { HOME: '/tmp' },
      pullImage: true,
    });
    childLogger.info(
        `Successfully generated docs from ${inputDir} into ${outputDir} using techdocs-container`,
    );
    childLogger.info(`Successfully generated docs from ${inputDir} into ${outputDir} using techdocs-container`);
  }
}

class DockerContainerRunner implements ContainerRunner {
  private readonly dockerClient: Docker;

  constructor(options: { dockerClient: Docker }) {
    this.dockerClient = options.dockerClient;
  }

  async runContainer(options: RunContainerOptions) {
    const {
      imageName,
      command,
      args,
      mountDirs = {},
      workingDir,
      logStream = new PassThrough(),
      envVars = {},
      pullImage = true,
    } = options;

    if (pullImage) {
      await new Promise<void>((resolve, reject) => {
        this.dockerClient.pull(imageName, {}, (err, stream) => {
          if (err) return reject(err);
          stream.pipe(logStream, { end: false });
          stream.on('end', () => resolve());
          stream.on('error', (error: Error) => reject(error));
          return undefined;
        });
      });
    }

    const userOptions = {
      User: ""
    };
    if (process.getuid && process.getgid) {
      // Files that are created inside the Docker container will be owned by
      // root on the host system on non Mac systems, because of reasons. Mainly the fact that
      // volume sharing is done using NFS on Mac and actual mounts in Linux world.
      // So we set the user in the container as the same user and group id as the host.
      // On Windows we don't have process.getuid nor process.getgid
      userOptions.User = `${process.getuid()}:${process.getgid()}`;
    }

    // Initialize volumes to mount based on mountDirs map
    const Volumes: { [T: string]: object } = {};
    for (const containerDir of Object.values(mountDirs)) {
      Volumes[containerDir] = {};
    }

    // Create bind volumes
    const Binds: string[] = [];
    for (const [hostDir, containerDir] of Object.entries(mountDirs)) {
      // Need to use realpath here as Docker mounting does not like
      // symlinks for binding volumes
      const realHostDir = fs.realpathSync(hostDir);
      Binds.push(`${realHostDir}:${containerDir}`);
    }

    // Create docker environment variables array
    const Env = [];
    for (const [key, value] of Object.entries(envVars)) {
      Env.push(`${key}=${value}`);
    }

    const [{ Error: error, StatusCode: statusCode }] =
        await this.dockerClient.run(imageName, args, logStream, {
          Volumes,
          HostConfig: {
            AutoRemove: true,
            Binds: Binds,
          },
          ...(workingDir ? { WorkingDir: workingDir } : {}),
          Entrypoint: command,
          Env,
          ...userOptions,
        } as Docker.ContainerCreateOptions);

    if (error) {
      throw new Error(
          `Docker failed to run with the following error message: ${error}`,
      );
    }

    if (statusCode !== 0) {
      throw new Error(
          `Docker container returned a non-zero exit code (${statusCode})`,
      );
    }
  }
}
