import { database } from './sequelizeLoader';
import { Sequelize, Model, DataTypes, BuildOptions } from 'sequelize';
import sequelize = require('sequelize');

export class Omikuji extends Model {
  public slackId!: string;
  public receiptDate!: Date;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

Omikuji.init(
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
    tableName: 'omikuji',
    sequelize: database,
    timestamps: true,
    indexes: [
      {
        fields: ['receiptDate']
      }
    ]
  }
);
