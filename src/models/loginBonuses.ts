import { database } from './sequelizeLoader';
import { Sequelize, DataTypes } from 'sequelize';

export const LoginBonus = database.define(
  'login_bonuses',
  {
    slackId: {
      type: DataTypes.STRING,
      primaryKey: true,
      allowNull: false
    },
    receiptDate: {
      type: DataTypes.DATEONLY,
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
