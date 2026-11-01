# Política de Privacidade

*Última atualização: 31 de outubro de 2026*

O Pavurio é um aplicativo de acompanhamento dos cuidados com animais de estimação. Esta política explica o que o aplicativo armazena, onde, e como excluir esses dados. Em resumo: **os dados dos seus animais ficam no seu telefone, uma cópia de backup é mantida na sua conta Pavurio para que você possa restaurá-la, e nós nunca vendemos dados nem exibimos anúncios.**

## O que o Pavurio armazena

**O que você insere.** Seus animais (nome, espécie, aparência, aniversário, data de adoção), os cuidados que você registra, rotinas e lembretes, consultas veterinárias, pesos, registros de saúde, momentos (títulos e legendas) e as configurações do aplicativo.

- Esses dados são salvos **no seu telefone**.
- Uma **cópia de backup** é salva na sua conta Pavurio (Google Firebase Cloud Firestore) para que você possa recuperá-los depois de trocar ou redefinir o telefone. Ela está vinculada à sua conta e só pode ser lida por você.

**Fotos e anexos** que você adiciona a registros e momentos ficam **apenas no seu telefone**. Eles não são enviados para nenhum servidor.

**Sua conta (Firebase Authentication).**

- Cada instalação recebe automaticamente um ID de conta aleatório, para que seus dados tenham backup desde o início.
- Se você optar por salvar sua conta, também armazenamos o **endereço de e-mail** do método de login que você escolher: Google, Iniciar sessão com a Apple, ou e-mail e senha.
- Endereços de e-mail usados com senha são confirmados por um código de 6 dígitos que enviamos para você por e-mail. O código é armazenado apenas de forma embaralhada (hash) e expira após 10 minutos. A redefinição de senha funciona da mesma maneira.
- Com Iniciar sessão com a Apple, você pode ocultar seu e-mail; nesse caso, a Apple nos fornece um endereço de retransmissão privado.
- Não pedimos o seu nome.

**Relatórios de falhas (Firebase Crashlytics).**

- Se o aplicativo travar, é enviado um relatório com detalhes técnicos: modelo do dispositivo, versão do sistema e do aplicativo, e o que o aplicativo estava fazendo.
- Ele é vinculado ao ID de conta aleatório, nunca aos dados dos seus animais.
- Você pode desativar isso em **Configurações → Conta → Compartilhar relatórios de falhas**.

**Compras.**

- O Pavurio Pro é comprado pela App Store ou pelo Google Play; nunca temos acesso aos seus dados de pagamento.
- Para saber se o Pro está ativo, usamos o **RevenueCat**, que recebe seu ID de conta aleatório e seus recibos de compra.

**E-mails que enviamos.**

- Enviamos e-mails relativos à conta: códigos de login e códigos de redefinição de senha.
- Enviamos dicas e novidades **somente se você marcar a caixa correspondente** ao criar sua conta. Você pode cancelar a assinatura de qualquer boletim com um clique.
- Os e-mails são enviados por meio do **Resend**, que recebe seu endereço de e-mail e o conteúdo da mensagem.

**Notificações.** Os lembretes são agendados no seu telefone; nenhum conteúdo de lembrete é enviado para nós.

## O que o Pavurio não faz

- Nenhuma publicidade e nenhum SDK de anúncios.
- Nenhuma venda ou compartilhamento de dados pessoais.
- Nenhum rastreamento em outros aplicativos ou sites.
- Nenhum SDK de análise (analytics). O Pavurio não fornece aconselhamento médico.

## Quem processa dados em nosso nome

| Serviço | Finalidade | Dados |
|---|---|---|
| Google Firebase (Authentication, Cloud Firestore, Cloud Functions, Crashlytics) | conta, códigos por e-mail, backup, relatórios de falhas | ID de conta, e-mail de login, escolha quanto ao boletim, cópia de backup, relatórios de falhas |
| Resend | envio dos e-mails com códigos e, se você aceitar, do boletim | endereço de e-mail, conteúdo da mensagem |
| RevenueCat | verificação do Pavurio Pro | ID de conta, recibos de compra |
| Apple / Google | login, pagamentos, distribuição do aplicativo | conforme descrito nas respectivas políticas |

Esses fornecedores podem processar dados fora do seu país (por exemplo, nos Estados Unidos) ao abrigo das suas condições padrão de proteção de dados.

## Por quanto tempo mantemos os dados

- Seu backup e sua conta são mantidos enquanto sua conta existir.
- Os relatórios de falhas são mantidos pelo Crashlytics por até 90 dias.
- Excluir sua conta remove imediatamente sua conta e seu backup.

## Excluir seus dados

- **No aplicativo:** Configurações → Conta → **Excluir conta**. Isso exclui sua conta, seu backup e os dados no seu telefone.
- **Sem o aplicativo:** consulte [Excluir sua conta](delete-account.html).
- **Apenas os dados no seu telefone:** Configurações → Seus dados → Apagar tudo, ou exclua o aplicativo.
- **Exportar:** você pode exportar tudo a qualquer momento (Configurações → Seus dados → CSV / JSON).

## Seus direitos

Você pode solicitar o acesso, a correção, a exportação ou a exclusão dos seus dados pessoais, ou opor-se ao seu uso, escrevendo para **lesepavistespro@gmail.com**. Se você estiver na UE/EEE ou no Reino Unido, também pode apresentar uma reclamação à sua autoridade de proteção de dados.

## Crianças

O Pavurio não se destina a crianças menores de 13 anos (16 na UE), e não coletamos conscientemente dados delas.

## Alterações

Atualizaremos esta página e a sua data caso algo mude. Alterações importantes também serão exibidas no aplicativo.

**Contato:** lesepavistespro@gmail.com
