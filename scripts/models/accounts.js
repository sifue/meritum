'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
var sequelizeLoader_1 = require('./sequelizeLoader');
var sequelize_1 = require('sequelize');
exports.Account = sequelizeLoader_1.database.define(
  'account',
  {
    slackId: {
      type: sequelize_1.DataTypes.STRING,
      primaryKey: true,
      allowNull: false
    },
    name: {
      type: sequelize_1.DataTypes.STRING,
      allowNull: false
    },
    realName: {
      type: sequelize_1.DataTypes.STRING,
      allowNull: true
    },
    displayName: {
      type: sequelize_1.DataTypes.STRING,
      allowNull: true
    },
    meritum: {
      type: sequelize_1.DataTypes.INTEGER,
      allowNull: false
    },
    titles: {
      type: sequelize_1.DataTypes.STRING,
      allowNull: false
    },
    numOfTitles: {
      type: sequelize_1.DataTypes.INTEGER,
      allowNull: false
    }
  },
  {
    freezeTableName: true,
    timestamps: true,
    indexes: [
      {
        fields: ['numOfTitles', 'meritum']
      },
      {
        fields: ['meritum']
      },
      {
        fields: ['numOfTitles']
      }
    ]
  }
);
