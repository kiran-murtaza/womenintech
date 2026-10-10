import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as dotenv from 'dotenv';
import * as express from 'express';

dotenv.config();

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: false });

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // Global prefix for all routes
  app.setGlobalPrefix('api');

  // Enable CORS for frontend integration
  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
  });

  const port = process.env.PORT || 4000;
  await app.listen(port);
  console.log(`\n🚀 Women in Tech Backend running on: http://localhost:${port}/api`);
  console.log(`📄 Bills endpoints:`);
  console.log(`   POST http://localhost:${port}/api/bills/process-file`);
  console.log(`   POST http://localhost:${port}/api/bills/process-directory`);
  console.log(`   POST http://localhost:${port}/api/bills/upload\n`);
}

bootstrap();
