/**
 * Gateway recusou um dado do cliente (CPF, celular, e-mail, nome, CEP/endereço). Outro gateway
 * recusaria o mesmo dado, então o checkout mostra a mensagem em vez de tentar o gateway reserva.
 */
export class PayerDataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PayerDataError";
  }
}
