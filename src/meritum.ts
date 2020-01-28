// Description:
//   毎日ログインボーナスでもらった「めりたん」というポイントを使って遊ぶSlack用チャットボットゲーム

import { Robot, Response } from 'hubot';

import { Account } from './models/accounts';
import { LoginBonus } from './models/loginBonuses';

// DB同期
(async () => {
  await Account.sync();
  await LoginBonus.sync();
})();

interface ResponseEnv<R> extends Response<R> {
  envelope: {
    room: string;
  };
}

module.exports = (robot: Robot<any>) => {
  // 使い方
  robot.hear(/^mhelp>$/i, (msg: Response<Robot<any>>) => {
    msg.send(
      'プロジェクトmeritumとは、めりたんを集めるプロジェクト。' +
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
        '`msend> (数値) (@ユーザー名)` : 指定したユーザーに数値で指定しためりたんを送る'
    );
  });
};
