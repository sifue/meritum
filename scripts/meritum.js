"use strict";
// Description:
//   毎日ログインボーナスでもらった「めりたん」というポイントを使って遊ぶSlack用チャットボットゲーム
Object.defineProperty(exports, "__esModule", { value: true });
module.exports = function (robot) {
    // 使い方
    robot.hear(/^mhelp>$/i, function (msg) {
        msg.send('hello!');
    });
};
