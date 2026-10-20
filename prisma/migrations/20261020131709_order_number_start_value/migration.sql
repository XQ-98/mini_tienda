-- El valor INICIAL de la secuencia también es 1001: si la tabla se reinicia
-- (TRUNCATE ... RESTART IDENTITY, restauraciones), la numeración no vuelve a 1.
ALTER SEQUENCE "Order_number_seq" START WITH 1001;
