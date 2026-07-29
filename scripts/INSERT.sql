
/*---INSERE ADMIN---*/
/*
INSERT INTO "Users" (username, password, role, "createdAt", "updatedAt")
VALUES ('Admin', '$2b$10$dY9/4fmpy3vdftalTXrglenQ/6vziqozDLXL2PQBqyVJSZ47sZ3Cq', 'adm', NOW(), NOW())
*/
/*------------------*/

/*---INSERE REPRESENTANTE---*/
/*
WITH new_user AS (
	INSERT INTO "Users" (username, password, role, "createdAt", "updatedAt")
	VALUES ('Rep. Sudeste', '$2b$10$9NEYTvUKY.cK03U8vEPjRO3XdOSukNer1rfwpjl5HJRB88F2EQ8Ty', 'representante', NOW(), NOW())
	RETURNING id
)
INSERT INTO "Representantes" (user_id, email)
SELECT id, 'representante.sudeste@hotmail.com'
FROM new_user;
*/
/*--------------------------*/

/*---INSERE REVENDA---*/

WITH new_user AS (
	INSERT INTO "Users" (username, password, role, "createdAt", "updatedAt")
	VALUES ('danilo@technofer.com.br', '$2b$10$Qvmce4HaGvOvRU0Z6pna.eUF4Ia5nuo4mLn36CleSICr5U0HJ6z9S', 'revenda', NOW(), NOW())
	RETURNING id
)
INSERT INTO "Revendas" (user_id, cnpj, name, cep, cidade, estado)
SELECT id, '48239336000138', 'Technofer', '14803851', 'Araraquara', 'SP'
FROM new_user;

/*--------------------*/