"use strict";
// Description:
//   毎日ログインボーナスでもらった「めりたん」というポイントを使って遊ぶSlack用チャットボットゲーム
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const sequelize_1 = require("sequelize");
const sequelizeLoader_1 = require("./models/sequelizeLoader");
const accounts_1 = require("./models/accounts");
const loginBonuses_1 = require("./models/loginBonuses");
/**
 * ログインボーナス受領日を取得する、午前7時に変わるため、7時間前の時刻を返す
 * @returns {Date} 7時間前の時刻
 */
function getReceiptToday() {
    return new Date(Date.now() - 1000 * 60 * 60 * 7);
}
// DB同期
(() => __awaiter(void 0, void 0, void 0, function* () {
    yield accounts_1.Account.sync();
    yield loginBonuses_1.LoginBonus.sync();
}))();
module.exports = (robot) => {
    // ヘルプ表示
    robot.hear(/^mhelp>$/i, (res) => {
        res.send('プロジェクトmeritumとは、めりたんを集めるプロジェクト。' +
            '毎日のログインボーナスを集めて、ガチャを回し、称号を集めよう！' +
            '他人に迷惑をかけたりしないように！めりたんが消滅します！' +
            'めりたんbotをランキング100以下にしたら勝利！\n' +
            '■コマンド説明\n' +
            '`mhelp>` : めりたんbotの使い方を表示。\n' +
            '`mlogin>` : ログインボーナスの100めりたんをゲット。毎朝7時にリセット。\n' +
            '`mjanken> (1-10) (グー|チョキ|パー)` : めりたんbotと数値で指定しためりたんを賭けてジャンケン。\n' +
            '`mgacha>` : 80めりたんでガチャを回して称号をゲット。\n' +
            '`mself>` : 自分のめりたん、称号数、全称号、順位を表示。\n' +
            '`mranking>` : 称号数、次にめりたんで決まるランキングを表示。\n' +
            '`mrank> (@ユーザー名)` : 指定したユーザーのめりたん、称号数、全称号、順位を表示。\n' +
            '`msend> (数値) (@ユーザー名)` : 指定したユーザーに数値で指定しためりたんを送る');
    });
    // ヘルプ表示
    robot.hear(/^mlogin>$/i, (res) => __awaiter(void 0, void 0, void 0, function* () {
        const user = res.message.user;
        const slackId = user.id;
        const name = user.name;
        const realName = user.real_name;
        const slack = user.slack;
        const displayName = slack.profile.display_name;
        const t = yield sequelizeLoader_1.database.transaction();
        try {
            const receiptDate = getReceiptToday();
            const countLoginBonus = yield loginBonuses_1.LoginBonus.count({
                where: {
                    slackId: slackId,
                    receiptDate: {
                        [sequelize_1.Op.eq]: receiptDate
                    }
                }
            });
            if (countLoginBonus === 1) {
                // 取得済み
                yield t.commit();
                res.send(`<@${slackId}>さんは既に本日のログインボーナスを取得済みです。`);
            }
            else {
                // 付与へ
                // アカウントがない場合には作り、100めりたん付与、ログインボーナス実績を追加
                const oldAccount = yield accounts_1.Account.findByPk(slackId);
                let meritum = 0;
                if (!oldAccount) {
                    meritum += 100;
                    yield accounts_1.Account.create({
                        slackId,
                        name,
                        realName,
                        displayName,
                        meritum,
                        titles: '',
                        numOfTitles: 0
                    });
                }
                else {
                    meritum = oldAccount.meritum + 100;
                    yield accounts_1.Account.update({ meritum }, {
                        where: {
                            slackId: slackId
                        }
                    });
                }
                // ログインボーナス実績を作成
                yield loginBonuses_1.LoginBonus.create({
                    slackId,
                    receiptDate
                });
                yield t.commit();
                res.send(`<@${slackId}>さんにログインボーナス100めりたんを付与し、 ${meritum}めりたんとなりました。`);
            }
        }
        catch (e) {
            console.log('Error on mlogin> e:');
            console.log(e);
            yield t.rollback();
        }
    }));
};
