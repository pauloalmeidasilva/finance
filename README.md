# neutralinojs-minimal

The default template for a Neutralinojs app. It's possible to use your favorite frontend framework by using [these steps](https://neutralino.js.org/docs/getting-started/using-frontend-libraries).

## Persistência

Os dados financeiros são armazenados em SQLite no arquivo `finance.db`, dentro do diretório de dados do Neutralino (`NL_DATAPATH`). O aplicativo usa `sql.js` localmente, sem depender de servidor ou conexão com a internet.

A camada de persistência está centralizada em `resources/js/core.js`. O banco cria as tabelas relacionais de contas, períodos, categorias, subcategorias, lançamentos, investimentos e configurações. Dados antigos de `finance.sqlite`, da tabela `app_state` ou da chave `finance_data` do armazenamento do Neutralino são migrados automaticamente para `finance.db`. As telas continuam usando o mesmo objeto `FinanceCore.data`, enquanto `save()` sincroniza os dados em uma única transação SQLite.

## Contributors

[![Contributors](https://contrib.rocks/image?repo=neutralinojs/neutralinojs-minimal)](https://github.com/neutralinojs/neutralinojs-minimal/graphs/contributors)

## License

[MIT](LICENSE)

## Icon credits

- `trayIcon.png` - Made by [Freepik](https://www.freepik.com) and downloaded from [Flaticon](https://www.flaticon.com)
