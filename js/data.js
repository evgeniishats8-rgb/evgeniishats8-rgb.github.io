window.SITE = {
  SCENES: [
    { id: "me_fly",    lora: "jdrobyshev_v7", seed: "2280", tag: "jdrobyshev 98 %",      subject: "man in a black suit, flying", scene: "liquid chrome above the clouds", camera: "orbit, 35mm" },
    { id: "w_oakley",  lora: "oakley_goggles_v3", seed: "1997", tag: "",                subject: "motocross goggles", scene: "desert sunset, sand in the air", camera: "macro, 100mm" },
    { id: "w_zepro",   lora: "zepro_oil_v2", seed: "4120", tag: "",                subject: "golden motor oil", scene: "assembles into a race engine", camera: "black studio, 50mm" },
    { id: "me_sponge", lora: "jdrobyshev_v7", seed: "7070", tag: "jdrobyshev 97 %",      subject: "white shirt, red tie, brown shorts", scene: "rides a jellyfish over Haifa", camera: "drone, 24mm" },
    { id: "w_ikar",    lora: "ikar_ice_v4", seed: "1133", tag: "",                subject: "hockey puck on ice", scene: "arena holds its breath", camera: "slow motion, 1000 fps" },
    { id: "me_boar",   lora: "jdrobyshev_v7", seed: "2024", tag: "jdrobyshev 96 %",      subject: "rider on a wild boar", scene: "Bahai Gardens, Haifa", camera: "tracking, 35mm" },
    { id: "w_laba",    lora: "laba_bottle_v2", seed: "3030", tag: "",                subject: "glass bottle, linen", scene: "morning sun, sea breeze", camera: "product, 85mm" },
    { id: "me_daisy",  lora: "jdrobyshev_v7", seed: "1208", tag: "jdrobyshev 99 %",     subject: "man in black", scene: "walks a daisy petal big as a house", camera: "wide, 24mm" }
  ],
  ROLES: [
    { id: "me_fly", role: "ЛЕЧУ", role_en: "FLYING" }, { id: "me_sponge", role: "СПАНЧ БОБ", role_en: "SPONGEBOB" }, { id: "me_boar", role: "НА КАБАНЕ", role_en: "ON A BOAR" },
    { id: "me_daisy", role: "НА РОМАШКЕ", role_en: "ON A DAISY" }, { id: "me_roach", role: "НА ТАРАКАНЕ", role_en: "ON A ROACH" }, { id: "me_office", role: "В ОФИСЕ", role_en: "AT THE OFFICE" },
  ],
  // kind: brand бренды, me со мной, art личное и концепты
  WORKS: [
    { id: "w_f1red", date: "2026-11-02",   w: 848,  h: 464,  title: "Пилот", title_en: "Pilot", tag: "личное", kind: "art" },
    { id: "w_ikar", date: "2026-09-15",    w: 1280, h: 720,  title: "ИКАР", title_en: "IKAR", tag: "реклама", kind: "brand" },
    { id: "w_car", date: "2026-09-05",     w: 720,  h: 1280, title: "Машина и телефон", title_en: "Car and phone", tag: "личное", kind: "art", link: "https://www.instagram.com/reel/Dc6tn0Ns1CO/" },
    { id: "w_review", date: "2026-09-05",  w: 720,  h: 1280, title: "ИИ-обзор машины", title_en: "AI car review", tag: "личное", kind: "art", link: "https://www.instagram.com/reel/Dc6ARjEM-n1/" },
    { id: "w_range", date: "2026-08-27",   w: 1280, h: 548,  title: "Range Rover, The Rebirth", tag: "концепт", kind: "art", link: "https://www.instagram.com/reel/DcjBu3TsZwO/" },
    { id: "w_ert", date: "2026-08-20",     w: 1280, h: 534,  title: "Эр-Телеком", title_en: "ER-Telecom", tag: "имидж", kind: "brand" },
    { id: "w_juice", date: "2026-08-14",   w: 1280, h: 549,  title: "Сок", title_en: "Juice", tag: "реклама", kind: "brand" },
    { id: "w_dm", date: "2026-08-14",      w: 1280, h: 549,  title: "Детский мир", title_en: "Detsky Mir", tag: "реклама", kind: "brand" },
    { id: "w_time", date: "2026-08-12",    w: 1280, h: 548,  title: "Сквозь время", title_en: "Through Time", tag: "личное", kind: "art", link: "https://www.instagram.com/reel/Db7jYcdMbx4/" },
    { id: "me_fly", date: "2026-07-12", w: 1920, h: 822, title: "Полёт в чёрном костюме", title_en: "Black suit flight", tag: "со мной", kind: "me", link: "https://www.instagram.com/reel/DasLcfusgy-/" },
    { id: "me_boar", date: "2026-07-01", w: 1920, h: 822, title: "Верхом на кабане", title_en: "Riding a boar", tag: "со мной", kind: "me" },
    { id: "me_sponge", date: "2026-07-01", w: 1470, h: 630, title: "Спанч Боб из Хайфы", title_en: "SpongeBob of Haifa", tag: "со мной", kind: "me" },
    { id: "me_daisy", date: "2026-07-01", w: 1920, h: 824, title: "Ромашка", title_en: "Daisy", tag: "со мной", kind: "me" },
    { id: "me_office", date: "2026-07-01", w: 1920, h: 822, title: "Офис", title_en: "Office", tag: "со мной", kind: "me" },
    { id: "w_move", date: "2026-07-01",    w: 1280, h: 549,  title: "Движение камеры", title_en: "Camera move", tag: "личное", kind: "art" },
    { id: "w_jam", date: "2026-06-29",     w: 1280, h: 548,  title: "Варенье и Карлсон", title_en: "Jam and Carlson", tag: "со мной", kind: "me" },
    { id: "me_roach", date: "2026-06-26", w: 1920, h: 816, title: "Таракан и пицца", title_en: "Roach and pizza", tag: "со мной", kind: "me" },
    { id: "w_oakley", date: "2026-06-26",  w: 1280, h: 544,  title: "Oakley", tag: "концепт", kind: "art" },
    { id: "w_laba", date: "2026-06-11",    w: 1280, h: 720,  title: "ЛАБА", title_en: "LABA", tag: "реклама", kind: "brand" },
    { id: "w_23", date: "2026-06-01",      w: 720,  h: 1280, title: "23", tag: "личное", kind: "art" },
    { id: "w_zepro", date: "2026-04-09",   w: 1280, h: 720,  title: "Zepro", tag: "реклама", kind: "brand" },
    { id: "w_bike", date: "2026-01-28",    w: 1280, h: 528,  title: "Велосипед и телефон", title_en: "Bike and phone", tag: "личное", kind: "art" },
    { id: "w_ninja", date: "2026-01-03",   w: 640,  h: 274,  title: "Ниндзя", title_en: "Ninja", tag: "личное", kind: "art", link: "https://www.instagram.com/reel/DTDbZTxDPb-/" },
    { id: "w_helmet", date: "2025-12-30",  w: 640,  h: 334,  title: "Шлем", title_en: "Helmet", tag: "личное", kind: "art", link: "https://www.instagram.com/p/DS4ddS5jL1z/" },
    { id: "w_polar", date: "2025-12-29",   w: 960,  h: 534,  title: "Polar Night, Legal Unity", tag: "ивент", kind: "brand", link: "https://www.instagram.com/p/DS25bESDBwh/" },
    { id: "w_legal", date: "2025-12-18",   w: 720,  h: 1280, title: "Legal Unity", tag: "ивент", kind: "brand" },
    { id: "w_circus", date: "2025-10-23",  w: 720,  h: 1280, title: "Legal Circus", tag: "ивент", kind: "brand" },
    { id: "w_moto", date: "2025-09-08",    w: 720,  h: 1280, title: "Мото", title_en: "Moto", tag: "личное", kind: "art" },
    { id: "w_prada", date: "2025-09-08",   w: 720,  h: 1280, title: "Prada", tag: "концепт", kind: "art" },
    { id: "w_f1", date: "2025-09-08",      w: 1280, h: 548,  title: "F1", tag: "концепт", kind: "art" },
    { id: "w_odyssey", date: "2025-09-01", w: 1280, h: 548,  title: "Одиссей", title_en: "Odyssey", tag: "личное", kind: "art" }
  ],
  CLIENTS: ["ИКАР", "Эр-Телеком", "Дом.ру", "ЛАБА", "VK", "MAX", "Legal Unity"],
  CLIENTS_EN: ["IKAR", "ER-Telecom", "Dom.ru", "LABA", "VK", "MAX", "Legal Unity"],
};

/* загрузка данных с повтором: короткий обрыв сети не должен оставлять блок пустым */
window.SITE.getJson = async (url, tries = 4) => {
  for (let n = 0; n < tries; n++) {
    try {
      const response = await fetch(url);
      if (response.ok) return await response.json();
    } catch (e) { /* следующая попытка ниже */ }
    await new Promise((done) => setTimeout(done, 700 * (n + 1)));
  }
  throw new Error(`не загрузилось: ${url}`);
};
