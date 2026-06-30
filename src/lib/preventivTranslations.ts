export type PreventivLang = "en" | "it" | "fr";

export interface PreventivStrings {
  quote: string;
  patient: string;
  date: string;
  service: string;
  qty: string;
  price: string;
  total: string;
  notes: string;
  warrantyTitle: string;
  warrantyLines: string[];
  paymentTitle: string;
  paymentLines: string[];
  servicesTitle: string;
  servicesLines: string[];
  defaultSectionName: string;
}

export const PREVENTIV_STRINGS: Record<PreventivLang, PreventivStrings> = {
  en: {
    quote: "QUOTE",
    patient: "PATIENT",
    date: "DATE",
    service: "SERVICE",
    qty: "QTY",
    price: "PRICE",
    total: "TOTAL",
    notes: "NOTES",
    warrantyTitle: "Warranty",
    warrantyLines: [
      "All our interventions are guaranteed. The guarantee covers the costs of a new intervention, free, therefore entirely paid by the clinic.",
      "In case of problems, the patient will only have to cover travel expenses. The guarantee is valid in the event of compliance with all the instructions received from our medical staff.",
      "The dental products we use are top-quality. We operate in compliance with international dental protocols and strict hygiene regulations (ISO 9001 Standard).",
      "We can demonstrate the origin of the materials through the implant passport and traceability document.",
    ],
    paymentTitle: "Payment",
    paymentLines: [
      "You can pay in cash, with POS directly in the clinic (a 3% commission is charged), or by bank transfer.",
      "In the latter case, it is necessary to inform your own bank of the intention to make a transfer from Albania, so that there are no unpleasant inconveniences, blocking, or various restrictions regarding the issuing of a bank transfer via mobile application from abroad (Albania).",
      "Checks and American Express are not accepted.",
    ],
    servicesTitle: "Services Included in the Package",
    servicesLines: [
      "Accommodation   ·   Airport pick-up and drop-off service   ·   Assistance throughout the entire stay",
      "Final consultation and check-up   ·   Certified CE products (European standards)   ·   Written guarantee with implant passport",
    ],
    defaultSectionName: "Services",
  },
  it: {
    quote: "PREVENTIVO",
    patient: "PAZIENTE",
    date: "DATA",
    service: "SERVIZIO",
    qty: "QUANTITÀ",
    price: "PREZZO",
    total: "TOTALE",
    notes: "NOTE",
    warrantyTitle: "Garanzia",
    warrantyLines: [
      "Tutti i nostri interventi sono garantiti. La garanzia copre i costi di un nuovo intervento, gratuito, quindi interamente a carico della clinica.",
      "In caso di problemi, il paziente dovrà coprire solo le spese di viaggio. La garanzia è valida a condizione che vengano rispettate tutte le istruzioni ricevute dal nostro personale medico.",
      "I prodotti dentali che utilizziamo sono di altissima qualità. Operiamo nel rispetto dei protocolli odontoiatrici internazionali e di rigorose norme igieniche (Standard ISO 9001).",
      "Possiamo dimostrare l'origine dei materiali tramite il passaporto dell'impianto e il documento di tracciabilità.",
    ],
    paymentTitle: "Pagamento",
    paymentLines: [
      "È possibile pagare in contanti, con POS direttamente in clinica (viene applicata una commissione del 3%), oppure tramite bonifico bancario.",
      "In quest'ultimo caso, è necessario informare la propria banca dell'intenzione di effettuare un bonifico dall'Albania, in modo da evitare spiacevoli inconvenienti, blocchi o varie restrizioni relative all'emissione di un bonifico tramite applicazione mobile dall'estero (Albania).",
      "Non si accettano assegni né American Express.",
    ],
    servicesTitle: "Servizi Inclusi nel Pacchetto",
    servicesLines: [
      "Alloggio   ·   Servizio di transfer da/per l'aeroporto   ·   Assistenza per tutta la durata del soggiorno",
      "Consulto e controllo finale   ·   Prodotti certificati CE (standard europei)   ·   Garanzia scritta con passaporto dell'impianto",
    ],
    defaultSectionName: "Servizi",
  },
  fr: {
    quote: "DEVIS",
    patient: "PATIENT",
    date: "DATE",
    service: "SERVICE",
    qty: "QTÉ",
    price: "PRIX",
    total: "TOTAL",
    notes: "REMARQUES",
    warrantyTitle: "Garantie",
    warrantyLines: [
      "Toutes nos interventions sont garanties. La garantie couvre les frais d'une nouvelle intervention, gratuite, donc entièrement prise en charge par la clinique.",
      "En cas de problème, le patient n'aura à couvrir que les frais de déplacement. La garantie est valable à condition de respecter toutes les instructions reçues de notre personnel médical.",
      "Les produits dentaires que nous utilisons sont de qualité supérieure. Nous opérons dans le respect des protocoles dentaires internationaux et de normes d'hygiène strictes (norme ISO 9001).",
      "Nous pouvons prouver l'origine des matériaux grâce au passeport de l'implant et au document de traçabilité.",
    ],
    paymentTitle: "Paiement",
    paymentLines: [
      "Vous pouvez payer en espèces, par carte (POS) directement à la clinique (une commission de 3 % est appliquée), ou par virement bancaire.",
      "Dans ce dernier cas, il est nécessaire d'informer votre banque de votre intention d'effectuer un virement depuis l'Albanie, afin d'éviter tout désagrément, blocage ou restriction concernant l'émission d'un virement via une application mobile depuis l'étranger (Albanie).",
      "Les chèques et American Express ne sont pas acceptés.",
    ],
    servicesTitle: "Services Inclus dans le Forfait",
    servicesLines: [
      "Hébergement   ·   Service de transfert aéroport (arrivée/départ)   ·   Assistance pendant tout le séjour",
      "Consultation et contrôle final   ·   Produits certifiés CE (normes européennes)   ·   Garantie écrite avec passeport de l'implant",
    ],
    defaultSectionName: "Services",
  },
};
