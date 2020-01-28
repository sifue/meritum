import { database } from './sequelizeLoader';
import { Sequelize, DataTypes } from 'sequelize';

export const Account = database.define(
  'account',
  {
    slackId: {
      type: DataTypes.STRING,
      primaryKey: true,
      allowNull: false
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    realName: {
      type: DataTypes.STRING,
      allowNull: true
    },
    displayName: {
      type: DataTypes.STRING,
      allowNull: true
    },
    meritum: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    titles: {
      type: DataTypes.STRING,
      allowNull: false
    },
    numOfTitles: {
      type: DataTypes.INTEGER,
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
