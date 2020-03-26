'use strict';
// Description:
//   ヘルプを表示
Object.defineProperty(exports, '__esModule', { value: true });
const constants_1 = require('./constants');
module.exports = robot => {
  // ヘルプ表示
  robot.hear(/^mhelp>$/i, res => {
    res.send(
      '*プロジェクトmeritum* とは、 *めりたん* と *称号* を集めるプロジェクト。' +
        '毎日のログインボーナスを集めて、ガチャを回し、称号を集めよう。' +
        '他人に迷惑をかける行為はしないでね。 *めりたん* が消滅します！' +
        'めりたんbotをランキング101位以下にしたらユーザーたちの勝利です。\n' +
        ':point_down::point_down::point_down::point_down: *〜コマンド説明〜* :point_down::point_down::point_down::point_down:\n' +
        '`mhelp>` : めりたんbotの使い方を表示。\n' +
        '`mlogin>` : ログインボーナスの *100めりたん* をゲット。毎朝7時にリセット。\n' +
        `\`mjanken> (グー|チョキ|パー) (1-${constants_1.MAX_JANKEN_BET})\` : めりたんbotとめりたんを賭けてジャンケン。\n` +
        `\`muj> (@ユーザー名) (1-${constants_1.MAX_USER_JANKEN_BET})\` : 指定したユーザーとめりたんを賭けてジャンケン。\n` +
        `\`mgacha>\` : *${constants_1.GACHA_MERITUM}めりたん* でガチャを回し、称号をゲット。\n` +
        `\`mmikuji>\` : *${constants_1.OMIKUJI_MERITUM}めりたん* でおみくじを引き、今日の運勢を占って景品をもらおう。\n` +
        '`mself>` : 自分の順位、称号数、全称号、めりたんを表示。\n' +
        '`mranking>` : 称号数で決まるランキングを表示(同称号数なら、めりたんの数順)。\n' +
        '`mrank> (@ユーザー名)` : 指定したユーザーの順位、称号数、全称号、めりたんを表示。\n' +
        '`msend> (@ユーザー名) (数値)` : 指定したユーザーに数値で指定しためりたんを送る。'
    );
  });
};
