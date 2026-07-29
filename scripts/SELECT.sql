







/*---SELECIONA TODOS OS USUARIOS---*/
/*
SELECT * FROM "Users"
*/
/*---------------------------------*/

/*---SELECIONA TODOS OS ADMINS---*/
/*
SELECT * FROM "Users" WHERE role = 'adm'
*/
/*-------------------------------*/

/*---SELECIONA TODOS OS REPRESENTANTES---*/
/*
SELECT * FROM "Representantes" r JOIN "Users" u ON u.id = r.user_id;
*/
/*---------------------------------------*/

/*---SELECIONA TODAS AS REVENDAS---*/

SELECT * FROM "Revendas" r JOIN "Users" u ON u.id = r.user_id;

/*---------------------------------*/

/*---SELECIONA TOKEN---*/
/*
SELECT * FROM "rd_tokens"
*/
/*---------------------*/