const config = require('../../config');
import { Sequelize } from 'sequelize';

export const database: Sequelize = new Sequelize(
  process.env.DATABASE_URL || config.databaseUrl,
  { logging: false }
);
