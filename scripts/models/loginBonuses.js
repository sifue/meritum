"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const sequelizeLoader_1 = require("./sequelizeLoader");
const sequelize_1 = require("sequelize");
class LoginBonus extends sequelize_1.Model {
}
exports.LoginBonus = LoginBonus;
LoginBonus.init({
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
}, {
    tableName: 'login_bonuses',
    sequelize: sequelizeLoader_1.database,
    timestamps: true,
    indexes: [
        {
            fields: ['receiptDate']
        }
    ]
});
