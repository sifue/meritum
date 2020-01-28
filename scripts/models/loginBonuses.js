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
var LoginBonus = /** @class */ (function (_super) {
    __extends(LoginBonus, _super);
    function LoginBonus() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    return LoginBonus;
}(sequelize_1.Model));
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
