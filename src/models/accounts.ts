import { database } from './sequelizeLoader';
import { Sequelize, Model, DataTypes, BuildOptions } from 'sequelize';
import sequelize = require('sequelize');

export class Account extends Model {
  public slackId!: string;
  public name!: string;
  public realName!: string;
  public displayName!: string;
  public meritum!: number;
  public titles!: string;
  public numOfTitles!: number;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

Account.init({
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
}, {
  tableName: 'accounts',
  sequelize: database,
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
