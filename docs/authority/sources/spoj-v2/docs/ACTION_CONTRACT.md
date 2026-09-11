# Ugovor svake radnje

JSON screen catalog beleži kontrole iz normalnog fixture prikaza, ne kompletan runtime call graph. Dynamic menus, drugi nalozi i alternate states zahtevaju dodatni pregled.

Za SVAKU native radnju sačuvati: stabilan UI action ID; nameru korisnika; entity/parent/version; nalog i role; permission/capability guard; ulazni validirani tip; postojeći service owner; read-before-write; requestId/receipt; potvrđeni ishod; refetch; error/stale/unknown ponašanje; cancel/Back; accessibility label; dokaz sa realnim izvorom.

Navigacijska radnja ne sme da usput potvrdi poslovnu promenu. Filter/paginacija ne smeju da izbrišu kolekciju. Success poruka ne sme da zameni rezultat komande. Izabrana ponuda ne sme da postane druga ponuda zbog novog sort-a. Checkbox potvrde se poništava kada se promene podaci koje korisnik potvrđuje. Retry iste namere koristi isti request ID; nova izmenjena namera nije isti retry.

Disabled/gated: objasni ljudski razlog u pravom kontekstu. Ne ostavljati dugme bez handlera ili sa console.log/toast lažnim uspehom. Prezentaciona stub funkcija mora biti eksplicitno dev-only. Svaka nepostojeća backend sposobnost ulazi u OPEN_GAPS; ne rešava se dekoracijom.

Production copy: ukloniti oznaku „demo“ tek kada postoji prava radnja i dokaz. Ne prepisivati „arhiva spremna“, „identitet potvrđen“, „poslato“ ili „objavljeno“ iz željenog vizuelnog stanja bez source potvrde. Razvojni nazivi RPC, gate kodovi i studio kontrole nisu namenjeni krajnjem korisniku.
