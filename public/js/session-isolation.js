// Isola o login POR ABA (08/10/2026).
// Causa do "403 Acesso negado" em tela de admin: `token` e `session` ficavam no
// localStorage, que é COMPARTILHADO entre todas as abas do mesmo site. Entrar como
// representante/revenda em outra aba trocava o token da aba do admin — que continuava
// mostrando "Admin" na tela, mas passava a enviar o token do outro usuário (403 nas
// rotas de admin; e ações podiam ser feitas com o usuário errado).
// Aqui as chaves "token" e "session" passam a viver no sessionStorage (por aba), sem
// precisar mexer nas dezenas de chamadas localStorage.getItem("token") do front.
// Deve ser o PRIMEIRO script carregado.
(function () {
    try {
        var CHAVES = { token: 1, session: 1 };
        var ss = window.sessionStorage;
        var proto = Storage.prototype;
        var get = proto.getItem, set = proto.setItem, del = proto.removeItem;
        proto.getItem = function (k) { return (this === window.localStorage && CHAVES[k]) ? get.call(ss, k) : get.call(this, k); };
        proto.setItem = function (k, v) { return (this === window.localStorage && CHAVES[k]) ? set.call(ss, k, v) : set.call(this, k, v); };
        proto.removeItem = function (k) { return (this === window.localStorage && CHAVES[k]) ? del.call(ss, k) : del.call(this, k); };
        // Limpa restos de versões antigas que guardavam o login no localStorage compartilhado.
        del.call(window.localStorage, "token");
        del.call(window.localStorage, "session");
    } catch (e) { /* sessionStorage indisponível: mantém o comportamento antigo */ }
})();
