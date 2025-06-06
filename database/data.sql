-- Use SQL insert statements to add any
-- starting/dummy data to your database tables

insert into "users" ("userId", "username", "hashedPassword", "rank", "plus")
values (1, 'test', '$argon2i$v=19$m=4096,t=3,p=1$h7icQD/xZr8akZsX+hNA0A$h68atJWyjvunAwNOpSpMfg9sPvoMQ6dKwoh0dJhurWA', 400, false),
       (2, 'admin', '$argon2i$v=19$m=4096,t=3,p=1$h7icQD/xZr8akZsX+hNA0A$h68atJWyjvunAwNOpSpMfg9sPvoMQ6dKwoh0dJhurWA', 400, true);

alter sequence "users_userId_seq" restart with 3;

-- EXAMPLE:

insert into "savedGames"
   ("userId", "at", "duration", "opponent", "outcome", "moveHistory", "diceRollHistory", "userPlaysWhite")
    values
      (1, 1741112992, 32, 'AI', 1, 'e3,Qf3,Bc4,Qf4,Qf6,e5,Ne7,h6,Qf5,Qxf7#', '3,0,2,3,2', true);
