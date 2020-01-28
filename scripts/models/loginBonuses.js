'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
var sequelizeLoader_1 = require('./sequelizeLoader');
var sequelize_1 = require('sequelize');
exports.LoginBonus = sequelizeLoader_1.database.define(
  'login_bonuses',
  {
    slackId: {
      type: sequelize_1.DataTypes.STRING,
      primaryKey: true,
      allowNull: false
    },
    receiptDate: {
      type: sequelize_1.DataTypes.DATEONLY,
      primaryKey: true,
      allowNull: false
    }
  },
  {
    freezeTableName: true,
    timestamps: true,
    indexes: [
      {
        fields: ['receiptDate']
      }
    ]
  }
);
