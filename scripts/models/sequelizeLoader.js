"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var config = require('../../config');
var sequelize_1 = require("sequelize");
exports.database = new sequelize_1.Sequelize(process.env.DATABASE_URL || config.databaseUrl, { logging: false });
