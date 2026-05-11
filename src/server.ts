import { buildApp } from './app.js';
import { env } from './config/env.js';

export async function startServer(): Promise<void> {
  const app = await buildApp();
  let isShuttingDown = false;

  const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
    if (isShuttingDown) {
      return;
    }

    isShuttingDown = true;
    app.log.info({ signal }, 'Graceful shutdown started.');

    try {
      await app.close();
      app.log.info('Server closed successfully.');
      process.exit(0);
    } catch (error: unknown) {
      app.log.error({ error, signal }, 'Error while closing server.');
      process.exit(1);
    }
  };

  process.on('SIGINT', () => {
    void shutdown('SIGINT');
  });

  process.on('SIGTERM', () => {
    void shutdown('SIGTERM');
  });

  try {
    await app.listen({
      port: env.PORT,
      host: '0.0.0.0',
    });
  } catch (error: unknown) {
    app.log.error({ error }, 'Failed to start server.');
    process.exit(1);
  }
}

void startServer();
