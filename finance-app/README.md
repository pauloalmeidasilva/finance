# neutralinojs-minimal

The default template for a Neutralinojs app. It's possible to use your favorite frontend framework by using [these steps](https://neutralino.js.org/docs/getting-started/using-frontend-libraries).

## Persistência

Os dados financeiros são armazenados em SQLite no arquivo `finance.sqlite`, dentro do diretório de dados do Neutralino (`NL_DATAPATH`). O aplicativo usa `sql.js` localmente, sem depender de servidor ou conexão com a internet.

A camada de persistência está centralizada em `resources/js/core.js`. Na primeira execução, o banco cria a tabela `app_state` e migra automaticamente os dados antigos da chave `finance_data` do armazenamento do Neutralino. As telas continuam usando o mesmo objeto `FinanceCore.data`, enquanto `save()` grava uma nova versão do banco SQLite.

## Contributors

[![Contributors](https://contrib.rocks/image?repo=neutralinojs/neutralinojs-minimal)](https://github.com/neutralinojs/neutralinojs-minimal/graphs/contributors)

## License

[MIT](LICENSE)

## Icon credits

- `trayIcon.png` - Made by [Freepik](https://www.freepik.com) and downloaded from [Flaticon](https://www.flaticon.com)
