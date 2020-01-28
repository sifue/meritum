import { database } from './sequelizeLoader';
import { Sequelize, Model, DataTypes, BuildOptions } from 'sequelize';
import sequelize = require('sequelize');

export class LoginBonus extends Model {
  public slackId!: string;
  public receiptDate!: Date;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

LoginBonus.init({
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
}, {
  tableName: 'login_bonuses',
  sequelize: database,
  timestamps: true,
  indexes: [
    {
      fields: ['receiptDate']
    }
  ]
}
);