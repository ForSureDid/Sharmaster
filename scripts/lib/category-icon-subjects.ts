// slug -> what the icon should depict (English, for the image prompt)
export const ICON_SUBJECTS: Record<string, string> = {
  // ── L1 ──
  "vozdushnye-shary-iz-lateksa": "a bunch of three round latex party balloons (blue, pink, yellow) with curly ribbons",
  "vozdushnye-shary-iz-folgi": "a shiny foil star balloon",
  "girlyandy-osveshchenie-fotozony": "a string of glowing round party light bulbs hanging in a curve",
  "igrushki": "a cute toy teddy bear",
  "karnavalnye-aksessuary": "a carnival eye mask with a small party hat",
  "lenty-i-banty": "a satin gift ribbon bow",
  "oborudovanie-i-aksessuary": "a helium gas tank cylinder with a balloon floating from its nozzle",
  "prazdnichnaya-poligrafiya": "a greeting card with a heart on it, standing slightly open",
  "svechi-i-fontany": "a birthday cake candle with a small flame",
  "servirovka-stola": "a plate with a fork and spoon",
  "tovary-dlya-prazdnika": "a party popper with confetti bursting out",
  "upakovka-dlya-podarkov": "a gift box tied with a ribbon",
  "floristika": "a small bouquet of flowers wrapped in paper",

  // ── Воздушные шары из латекса ──
  "kruglye-bez-risunka": "a single plain round latex balloon with a short ribbon",
  "kruglye-s-risunkom": "a round latex balloon decorated with a printed star and dot pattern",
  "linkoluny": "a long thin twisting balloon bent into a loop (linking balloon)",
  "nabory": "a set of five small colourful balloons tied together",
  "serdtsa": "a latex heart-shaped balloon",
  "shary-dlya-modelirovaniya": "a balloon dog twisted from a long modelling balloon",

  // ── Воздушные шары из фольги ──
  "3d-i-khodyachie-figury": "a foil balloon of a cute cartoon animal standing upright, like a walking balloon figure",
  "3d-sfery-i-spetsialnye-figury": "a large shiny round 3D foil sphere balloon",
  "deco-bubble": "a transparent clear bubble balloon with small confetti stars inside",
  "bez-risunka": "a plain glossy foil balloon in a simple rounded shape",
  "bolshie-figury": "a big foil balloon in the shape of a unicorn head",
  "bukvy-i-nadpisi": "a big foil balloon in the shape of the letter A",
  "mini-figury": "a small foil balloon on a stick in the shape of a smiling sun",
  "nabory-iz-figur": "a trio of foil balloons: a star, a heart and a circle",
  "serdtsa-krugi-i-zvezdy-s-risunkom": "a foil heart balloon with a pattern of hearts and dots",
  "tsifry": "a big foil balloon in the shape of the number 5",

  // ── Гирлянды, освещение, фотозоны ──
  "girlyandy-plakaty-podveski": "a happy birthday style triangle bunting flag garland (no text)",
  "zanaves": "a sparkly shimmering foil fringe curtain hanging down",
  "svetodiodnye-girlyandy-i-podsvetka": "a string of tiny warm glowing fairy lights",
  "svetodiodnye-nadpisi-i-tsifry": "a glowing neon-style number 1 sign",
  "svetodiodnye-figury": "a glowing LED light in the shape of a star",
  "tassel-i-dozhdik": "a tassel garland with long hanging colourful tassels",
  "fotozona-payetki": "a sequin wall panel with glittering round sequins",

  // ── Карнавальные аксессуары ──
  "aksessuary-i-atributika": "a pair of fun party glasses and a tiny moustache on a stick",
  "golovnye-ubory": "a shiny top hat",
  "dlya-pitomtsev": "a cute small party hat on a puppy ear shape for a pet",
  "kolpaki-yazyki-i-gorny": "a cone party hat with a pompom and a party horn blower",
  "krylya-i-nabory": "a pair of feathery angel wings",
  "maski": "a carnival masquerade mask",
  "obodki-i-zakolki": "a headband with cute bunny ears",
  "pariki-i-tsvetnye-pryadi": "a colourful rainbow clown wig",

  // ── Ленты и банты ──
  "banty": "a decorative gift bow with loops",
  "lenta-atlasnaya": "a spool of satin ribbon with the ribbon end curling out",
  "lenty": "a roll of curling gift ribbon",

  // ── Оборудование и аксессуары ──
  "aksessuary-dlya-sharov": "a balloon clip and a balloon ring accessory",
  "gazovoe-oborudovanie": "a gas valve regulator with a hose",
  "geliy-i-ballony": "a helium tank cylinder",
  "gruziki": "a balloon weight in the shape of a small round bell with a ribbon",
  "kleevye-pistolety-i-sterzhni": "a hot glue gun",
  "kompressory-i-nasosy": "a hand air pump for balloons",
  "kraska-dlya-pechati": "a paint tube with a drop of colourful paint",
  "palochki-i-nasadki": "a balloon stick with a cup holder",
  "plenka-samokleyashchayasya-oracal": "a roll of self-adhesive coloured film being peeled",
  "polimernyy-kley-dlya-sharov": "a glue bottle with a drop of glue",
  "stoyki-i-aeromozaika": "a balloon display stand frame holding balloons in a grid",

  // ── Праздничная полиграфия ──
  "konverty-i-korobki-dlya-deneg": "a gift envelope with a heart seal and a banknote peeking out",
  "nakleyki-i-markery": "a sheet of cute stickers next to a marker pen",
  "otkrytki": "a folded greeting card with a heart",

  // ── Свечи и фонтаны ──
  "svechi-dekorativnye": "a round decorative pillar candle with a flame",
  "svechi-dlya-torta": "a set of three striped birthday cake candles with flames",
  "fontany-dlya-torta": "a sparkler cake fountain candle throwing sparks",

  // ── Сервировка стола ──
  "lozhki-vilki-nozhi": "a fork, knife and spoon set",
  "odnorazovye-salfetki": "a folded paper napkin",
  "odnorazovye-skaterti": "a round table with a draped tablecloth",
  "odnorazovye-stakany": "a party paper cup with a straw",
  "odnorazovye-tarelki": "a stack of party paper plates",
  "servirovka-desertov": "a cupcake on a small dessert plate",
  "toppery-i-shpazhki": "a cake topper on a skewer with a star on top",
  "trubochki-i-palochki-dlya-kokteyley": "a striped drinking straw and a cocktail stirrer",

  // ── Товары для праздника ──
  "dym-bengalskie-ogni-pirotekhnika": "a sparkler stick throwing sparks",
  "igrovye-nabory": "a pair of dice and a deck of playing cards",
  "konfetti-i-dekor": "a pile of colourful confetti and streamers",
  "mylnye-puzyri": "a bottle of soap bubbles with a wand and floating bubbles",
  "pinyaty": "a donkey piñata shaped party piñata",
  "prazdnichnyy-dekor": "a paper pom-pom decoration and a paper fan",
  "khlopushki-kraska-kholi": "a confetti cannon with a burst of colour powder",

  // ── Упаковка для подарков ──
  "bumaga-i-plenka": "a roll of wrapping paper with a pattern of dots",
  "dlya-vina": "a wine bottle gift bag",
  "korobki": "a small closed gift box with a lid",
  "korobki-dlya-vozdushnykh-sharov": "a cube box with balloons floating out of it",
  "napolnitel": "a nest of shredded colourful paper filler",
  "pakety": "a gift paper bag with handles",

  // ── Флористика ──
  "bechevki-i-shnury": "a spool of natural twine string",
  "iskusstvennye-rasteniya": "a green leafy artificial plant in a pot",
  "kashpo-i-yashchiki-dlya-tsvetov": "a flower pot with a flower",
  "pakety-dlya-tsvetov": "a clear flower sleeve bag with a bouquet",
  "toppery-i-prishchepki": "a wooden clothespin with a small heart topper",
  "upakovochnaya-bumaga": "a sheet of kraft wrapping paper rolled up",
  "upakovochnaya-plenka": "a roll of clear cellophane wrapping film",
  "fatin-i-foamiran": "a swirl of soft tulle fabric and a foamiran flower",
};
