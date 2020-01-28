"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const sequelizeLoader_1 = require("./sequelizeLoader");
const sequelize_1 = require("sequelize");
class Account extends sequelize_1.Model {
}
exports.Account = Account;
Account.init({
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
}, {
    tableName: 'accounts',
    sequelize: sequelizeLoader_1.database,
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
});
