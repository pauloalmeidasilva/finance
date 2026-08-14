/**
 * ============================================================================
 * CORE.JS - GERENCIADOR DE BANCO DE DADOS (SQLITE)
 * ============================================================================
 * Este arquivo é o motor do banco de dados da aplicação.
 * Responsável por:
 * 1. Inicializar a biblioteca SQL.js.
 * 2. Criar as tabelas no arquivo .sqlite (Migrações/Schema).
 * 3. Ler e Persistir os dados fisicamente usando o filesystem do Neutralino.
 * 4. Executar operações CRUD (Create, Read, Update, Delete).
 */

const DatabaseManager = {
    // Nome do arquivo onde o banco de dados será salvo
    databaseName: "finance.sqlite",
    
    // Instância ativa do banco de dados na memória
    db: null,

    /**
     * Script SQL de criação das tabelas (Schema/Migrações).
     * Executado sempre na inicialização para garantir que as tabelas existam.
     */
    schema: `
        PRAGMA foreign_keys = ON;

        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS accounts (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            icon TEXT,
            color TEXT,
            is_active INTEGER NOT NULL DEFAULT 1
        );

        CREATE TABLE IF NOT EXISTS periods (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT,
            start_date TEXT NOT NULL,
            end_date TEXT,
            is_open INTEGER NOT NULL DEFAULT 1,
            close_description TEXT,
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS categories (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS subcategories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
            name TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS entries (
            id INTEGER PRIMARY KEY,
            account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
            period_id TEXT REFERENCES periods(id) ON DELETE SET NULL,
            type TEXT NOT NULL,
            value REAL NOT NULL DEFAULT 0,
            description TEXT,
            category TEXT,
            notes TEXT,
            date TEXT NOT NULL,
            created_at TEXT NOT NULL
        );
    `,

    /**
     * Carrega o banco de dados do disco rígido.
     * Se o arquivo não existir, cria um banco novo em memória e aplica o schema.
     */
    async init() {
        try {
            // Inicializa a engine do SQL.js buscando o arquivo WebAssembly na pasta lib
            const SQL = await initSqlJs({ locateFile: (file) => `js/lib/${file}` });
            
            // Define o caminho físico do arquivo no sistema operacional
            const dbPath = `${window.NL_DATAPATH || "."}/${this.databaseName}`;
            
            let fileBuffer = null;
            try {
                // Tenta ler os bytes do arquivo caso ele já exista
                fileBuffer = new Uint8Array(
                    await Neutralino.filesystem.readBinaryFile(dbPath)
                );
            } catch (err) {
                console.log("Arquivo de banco de dados não encontrado. Criando um novo...");
            }

            // Se existiam bytes lidos, abre o banco existente; senão, cria em memória
            this.db = fileBuffer ? new SQL.Database(fileBuffer) : new SQL.Database();
            
            // Aplica as instruções SQL de criação das tabelas
            this.db.run(this.schema);
            
            console.log("Banco de dados inicializado com sucesso.");
        } catch (error) {
            console.error("Erro crítico ao carregar o banco de dados:", error);
            throw error;
        }
    },

    /**
     * Grava os dados da memória de volta no arquivo físico do disco rígido.
     */
    async persist() {
        if (!this.db) throw new Error("O banco de dados não está inicializado.");
        
        // Exporta a base de dados atual como um array de bytes (Uint8Array)
        const binaryData = this.db.export();
        const dbPath = `${window.NL_DATAPATH || "."}/${this.databaseName}`;

        // Escreve os bytes no disco via API Nativa do Neutralino
        await Neutralino.filesystem.writeBinaryFile(dbPath, binaryData);
    },

    // ========================================================================
    // MÉTODOS GENÉRICOS DE CONSULTA E EXECUÇÃO DE SQL (CRUD BASE)
    // ========================================================================

    /**
     * Executa comandos SQL que ALTERAM dados (INSERT, UPDATE, DELETE).
     * @param {string} sqlString - Instrução SQL. Ex: "INSERT INTO categories VALUES (?, ?)"
     * @param {Array} params - Lista de parâmetros que substituem as interrogações (?).
     */
    async execute(sqlString, params = []) {
        try {
            this.db.run(sqlString, params);
            await this.persist(); // Salva no disco imediatamente após modificar
        } catch (error) {
            console.error(`Erro ao executar SQL: ${sqlString}`, error);
            throw error;
        }
    },

    /**
     * Executa comandos SQL de LEITURA (SELECT) e retorna os resultados estruturados em objetos.
     * @param {string} sqlString - Consulta SQL. Ex: "SELECT * FROM categories WHERE id = ?"
     * @param {Array} params - Lista de parâmetros para a consulta.
     * @returns {Array<Object>} Lista de objetos contendo chave/valor de cada coluna.
     */
    query(sqlString, params = []) {
        try {
            const stmt = this.db.prepare(sqlString);
            stmt.bind(params);
            
            const results = [];
            while (stmt.step()) {
                results.push(stmt.getAsObject());
            }
            stmt.free(); // Libera memória da consulta
            return results;
        } catch (error) {
            console.error(`Erro ao consultar SQL: ${sqlString}`, error);
            return [];
        }
    },

    /**
     * Executa uma consulta que retorna apenas um único registro.
     */
    queryOne(sqlString, params = []) {
        const results = this.query(sqlString, params);
        return results.length > 0 ? results[0] : null;
    }
};