"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
var sequelizeLoader_1 = require("./sequelizeLoader");
var sequelize_1 = require("sequelize");
var Account = /** @class */ (function (_super) {
    __extends(Account, _super);
    function Account() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    return Account;
}(sequelize_1.Model));
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
