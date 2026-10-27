MySQL (WorkBench / local) - Como aplicar o schema e usar com o backend

Passos rápidos:

1) Configure variáveis de ambiente no arquivo `.env` (ex.: em `backend_no_db_complete/.env`):

```
DB_TYPE=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASS=rootpw
DB_NAME=angel_guardian
```

2) Se preferir aplicar o arquivo SQL manualmente, abra o `sql/angel_guardian_init.sql` no MySQL Workbench e execute.

3) Ou aplique usando o script Node incluido (não precisa Docker):

```powershell
cd backend_no_db_complete
npm install
npm run db:apply-sql
```

4) Reinicie o backend:

```powershell
npm run start:static
```

5) Teste endpoints (ex.: registro/login) para garantir que a aplicação grava/consulta no MySQL.

Observações:
- O script `scripts/apply_sql_to_mysql.js` usa `mysql2` e lê as credenciais do `.env`.
- Se o schema já existe e você só precisa adicionar colunas `cpf`/`telefone`, rode no Workbench:

```sql
ALTER TABLE users ADD COLUMN cpf VARCHAR(30);
ALTER TABLE users ADD COLUMN telefone VARCHAR(40);
```
