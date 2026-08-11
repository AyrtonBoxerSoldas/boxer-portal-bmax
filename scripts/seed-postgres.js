const { sequelize, User, Representante, Revenda, RdToken, Negociacao } = require("../src/database");

async function seed() {
    try {
        console.log("Conectando ao banco...");
        await sequelize.authenticate();
        console.log("Conexão OK. Sincronizando tabelas...");
        await sequelize.sync({ force: true });
        console.log("Tabelas criadas. Inserindo dados...");

        // Users
        const users = [
            {id:1,username:"Admin",password:"$2b$10$dY9/4fmpy3vdftalTXrglenQ/6vziqozDLXL2PQBqyVJSZ47sZ3Cq",role:"adm"},
            {id:2,username:"Lucas do Vale",password:"$2b$10$rEVsVUuPrnGq6RGhvODBKOsPrkurwtSwvaccCRuHqIKFlzIoByhge",role:"representante"},
            {id:3,username:"Victor VLM",password:"$2b$10$rpOTzSFgRmL7OOwoOMQZbeeCrpa4sWkfLybJ6NzzXnuGIsJG6Zugi",role:"representante"},
            {id:4,username:"Fernando Augusto",password:"$2b$10$05vnkY/znQTVT/1BVACTGO4ShC2KLdslq/7Qwe3Jcf4m1nqujEbau",role:"representante"},
            {id:5,username:"Caio P Mancini",password:"$2b$10$wQ28MpwoD0bW/rOfJf2AOO9/OLXnj0u2PXkL02EwGFCns9aGyGxJq",role:"representante"},
            {id:6,username:"Hugo Carpanese",password:"$2b$10$TC0vVLVO8ps3zu7Mjc0yBetrqBHhH7KzPtIcS1vJ/PBUU3eo.qkMO",role:"representante"},
            {id:7,username:"Fernando Marques",password:"$2b$10$wSrGkQhRG8tj72ALLSs8Lue/7lgHzrWvUdSSpI6P7tG8crjr6wQc6",role:"representante"},
            {id:8,username:"Patrick",password:"$2b$10$/xz0/MJmtxxkFnJVTWXgoet/y.ZyKzrT2HjsCICUgVm8CQBlxrKYe",role:"representante"},
            {id:9,username:"Carlos",password:"$2b$10$VwMUwcacW7yw7GAWIXqZoO/9gIEqC5E.pMf17.ebl4Ur5hmtXGWbu",role:"representante"},
            {id:10,username:"Weberson",password:"$2b$10$jFGYm180Ullhv2YazTW0cuL99Ux3KWbVWaDLWmFwn5bbLa.TGK39m",role:"representante"},
            {id:13,username:"thiagocassano@eletrosoldalimeira.com.br",password:"$2b$10$W.m5PpGBIU3v2CmqpL81WO8hsRdCKdAA1zGT9GM50vkavr9GLxujq",role:"revenda"},
            {id:14,username:"marcio@luitex.com.br",password:"$2b$10$Rm3D8xC8.bo4xY1Q9lts6.k.0bbqEWr91vISADhybCZQn8mgP71mW",role:"revenda"},
            {id:15,username:"heitor@suprimig.com.br",password:"$2b$10$smYi/5SyjPKujy0/kPhQCeXDxjTYFmBvS2iMl6rYNi8Nx2mrE0DfW",role:"revenda"},
            {id:17,username:"danilo@technofer.com.br",password:"$2b$10$Qvmce4HaGvOvRU0Z6pna.eUF4Ia5nuo4mLn36CleSICr5U0HJ6z9S",role:"revenda"},
            {id:19,username:"Goy",password:"$2b$10$V3yvkaHyVb8BwyxrWP.zz.H74a9QwRsY3SObFMMNNclEkfR9gqWGa",role:"adm"},
            {id:20,username:"Billy",password:"$2b$10$Xe74DB/Tzz7BdilrEkEJ3ubBTAEUsmrbp9CkMQsP9aZqdAVSLe5/y",role:"adm"},
            {id:21,username:"André",password:"$2b$10$tv26ldLY9covu50Hsbk/ne.zqXffve3dugvYZwXmW/lH4/1HAtFzK",role:"adm"},
            {id:22,username:"compras@csferramentas.com.br",password:"$2b$10$5MEcDM9CSorpMKBAuil5Q.r4WKWbNbzfKlplZniTEOHH6UvXoA4Pu",role:"revenda"},
            {id:23,username:"luccas@ipanemasoldas.com.br",password:"$2b$10$IG0ssWCbpTo2XkhhyuWkFudoeqw/yJegBT9cF5E3QiHALO3e0w1bG",role:"revenda"},
            {id:24,username:"comercialsolda@hotmail.com",password:"$2b$10$8lbcXI8etZxHdvgCEj7sFe4iSktt7YMvL64czl02sb4LS9.8xipXi",role:"revenda"},
            {id:25,username:"compras@vrabrasivos.com.br",password:"$2b$10$uJTkCGZa3HqzLlBwbe3CaOcrjRB/eT0ThdW88gqnGPJgL8V7fOOia",role:"revenda"},
            {id:26,username:"nelson@oxirio.com.br",password:"$2b$10$uGTFxbdd1PpxLbMVszZhc.7EM1jWW92u0HXdyUE8dy/TJp56xtc8C",role:"revenda"},
            {id:27,username:"compras.alphabras@gmail.com",password:"$2b$10$qatD6ggstC.6YRxOlJtecezo6/Ab4RwaKvkMgQzpLXQxb9GMtkR.i",role:"revenda"},
            {id:28,username:"fiscal@edmaq.com.br",password:"$2b$10$awZYwfXjkoXK4fF6jEGMOuOI7Lo.q581HjO0h6y3q8YxJxVNyrC4e",role:"revenda"},
            {id:29,username:"ferragistaltda@hotmail.com",password:"$2b$10$z1Nv/qjuquzRRYioqoYVpOA6ggUoLlbWCmEBlyMRHSKFuZYNuTjsO",role:"revenda"},
            {id:30,username:"gilbertojmaria@gmail.com",password:"$2b$10$KHv4DmvWnot4oPDYRRTcDeN9Ey/klFCFrCJHhtw.Z4RbMNXpDZU9m",role:"revenda"},
            {id:31,username:"oxigenio@oxigeniojundiai.com.br",password:"$2b$10$krSzOY.Syw6Ugif0z1.dt.s1ds2hWeixhGgHgKZJScQwISZMt/ekm",role:"revenda"},
            {id:32,username:"ferreira@viasoldas.com.br",password:"$2b$10$.LrL0pJTgtibCs2T18XbsOYdLYbTdZ6UjPIL1QscWWmh./HjsQ0PS",role:"revenda"},
            {id:33,username:"diretoria@atualsoldas.com.br",password:"$2b$10$VMN.E2sj188bmDbh2UvYjO3mTupH5pAyaGUFlEe2KUiA5yfO5GcW6",role:"revenda"},
            {id:34,username:"coamassaadm@hotmail.com",password:"$2b$10$JIgn5q36xOlKXVU3vAyr3ua5tHuVrLldTYqGenQqHuPlw14rmzZWi",role:"revenda"},
            {id:35,username:"financeiro@cascavelsoldas.com.br",password:"$2b$10$deVtev6AjVB0RM9qjV2dwuU/nmbBwqMbQky2gNOltexGo8qOgdtUa",role:"revenda"},
            {id:36,username:"raphael@casadosoldador.com.br",password:"$2b$10$dOc2.nNViGMOwUDL4FwzqOBFSMNB6nQdw4aBUdKYN3NlaUpnqPGfm",role:"revenda"},
            {id:37,username:"financeiro1@casaparafuso.com",password:"$2b$10$QjvaZ6jjKciifn6Dkgs70uv0WHt5HDO01NM5g87pqbXU1.dEyR33m",role:"revenda"},
            {id:38,username:"ruzamparafusoseferramentas@gmail.com",password:"$2b$10$dbORZlQe.t5P8INi1IXI7ugJapbVwSp20kBzEUSwETNanJkjXDspa",role:"revenda"},
            {id:39,username:"schneider@sferramentas.com.br",password:"$2b$10$LSCGjWupUh.QTGjL4qh1hetUN4fOdHB0ZaocSHBXTHf1NxTFduPxu",role:"revenda"},
            {id:40,username:"marcos@brasolda.com.br",password:"$2b$10$sRi5zcOrAXrNeo2eMqbANOJ0EDLdBJiwS0e09Y8kiURr7FJBygdge",role:"revenda"},
            {id:41,username:"leandro.ferreirasoldas@hotmail.com",password:"$2b$10$onzxxFLmueXEhMFfQIuUGuy4w2/9G4/sXOdA38Ewn8AMiygQRbqlW",role:"revenda"},
            {id:42,username:"juniortrianorte1@gmail.com",password:"$2b$10$Zb.dXr9OkNgWWJ953iWYYuxyXCH/qc8RzTD0AL5OLikmArX985ahy",role:"revenda"},
            {id:43,username:"ademir.oliv@diafer.com.br",password:"$2b$10$CgsIuwNnx8VBi3/PKqSt4uLCKsjSi1rwN4pOY4nGAXnEywF7V18jq",role:"revenda"},
            {id:44,username:"vendasmilmaquinas2@gmail.com",password:"$2b$10$7WcpO2zM4nCdcyfdO6.nUutdjxZr3k3EtFcOSr5yal615SiXA6elO",role:"revenda"},
            {id:45,username:"comercial.totalsoldas@gmail.com",password:"$2b$10$wrkDZik732KN2M0He5dgP.DxHYa56MnaqAn2od1NpWSgX73lZk/86",role:"revenda"},
            {id:46,username:"edson@romaparafusos.com.br",password:"$2b$10$mnYPUApmA4LvHvI7WPigTe7inReen/0VRfBu/eaxoFydwp4YRM08u",role:"revenda"},
            {id:47,username:"financeiro@lcferragens.com.br",password:"$2b$10$qT0hB6AEWJ2f/OfhoEXwHOoVniiwINW0fN52nY62Ghh74vSntto5e",role:"revenda"},
            {id:48,username:"financeirofilial@bismark.com.br",password:"$2b$10$RKqCUrydXPu9fKIvTMbbYemc7SMd2W7BHHCmtN93/wzr4uIvKSmxe",role:"revenda"},
            {id:49,username:"wmseletronic@gmail.com",password:"$2b$10$89wb4tpa/UKMpm3nYzqmTOAlQ07P.9gpwSxvBHKrej.L9oema3OQW",role:"revenda"},
            {id:50,username:"locsoldas@locsoldas.com.br",password:"$2b$10$hWev0ptAEpI2jkOKu2aL0OxXlR8hz3T1zto8DIydzuv6vVY8dE8ci",role:"revenda"},
            {id:51,username:"paulo.neto@dominik.com.br",password:"$2b$10$ItZhhWFrtbBNfy4aWKttZeWo6oF/Kt7H5F5XQE/esjKvMuyiFbLKu",role:"revenda"},
            {id:52,username:"samta@samtaferramentas.com.br",password:"$2b$10$1Vh.tJ/dNGuJfh2hpFaANe/nwnKN1NlKCGCJLlCJdYJZ9Q9F0U5aa",role:"revenda"},
            {id:53,username:"compras@maqdima.com.br",password:"$2b$10$UgEuhUn3wxmHeWyKBwHwf.ggPrYb/7nlMcr6Pz2FXyHDVkeictqfy",role:"revenda"},
            {id:54,username:"compras1@lojastamoyo.com.br",password:"$2b$10$.aT.EOmDZ69Tihl0Qm/GPOBFckRK4wpaPty3sa2ogTWEbLctG2i6a",role:"revenda"},
            {id:55,username:"ferpar@ferpar.com.br",password:"$2b$10$KYZ85MePUVmtKb.94.r8pe.O8rDi5.wPrGH4hzDdAhjJtghnY13Ru",role:"revenda"},
            {id:56,username:"compras01@grupofermaq.com.br",password:"$2b$10$Iek5VvdEQNjcoF75TzS1Se0tSbP5x/jl96TWjxtcIKfnmxUW7PB9C",role:"revenda"},
            {id:57,username:"certtoferragens@certtoferragens.com.br",password:"$2b$10$wnX8N/B8gLccQXhRpO8mgOCnrqzIKv/w/FSTkwwtwp0TVR7OJ7IGu",role:"revenda"},
            {id:58,username:"tecmaquinas01@terra.com.br",password:"$2b$10$Th2GepWcQv3CdIBpkf0N3ufqltMs4dMzNjNjMPgxPp7RHshV64RpK",role:"revenda"},
            {id:59,username:"casadasferramentascri@outlook.com",password:"$2b$10$aBkHPj7nETQ6d8ujRMgjCe/mc0TlOv33zvgP5.KLIn89qHlt179qC",role:"revenda"},
            {id:60,username:"financeiro@apmaquinaseferramentas.com.br",password:"$2b$10$lEcb0kke/UGijRTJW926ouzkBlMiJMc0CQTZuzIEMNz.LSjYD7FZW",role:"revenda"},
            {id:61,username:"financeiro@kapdima.com.br",password:"$2b$10$s.L/c1QeC.9LtZCFtHQvIuCl7WeXkJ2QCMQxp7IBKDFc/xRzAoBWa",role:"revenda"},
            {id:62,username:"financeiro@febrazo.com.br",password:"$2b$10$pYOIprWoo65xYHjmUxibv.fUccaGGWsAdepo2wWCdjWDthynYoSa2",role:"revenda"},
            {id:63,username:"compras@nazarenosoldas.com.br",password:"$2b$10$CmNpiqOIQLcNjGQvi.5a/e663470jrZetCYb9MGP/f37gFBXtbh8O",role:"revenda"},
            {id:64,username:"mattes@mattes.ind.br",password:"$2b$10$.zoPEDLx/UYcrO1JuEVJQuWvViE5ZiDHDo6zvKk2HqF52jX9cUZP.",role:"revenda"},
            {id:66,username:"avantpar1@hotmail.com",password:"$2b$10$atpwAezAQ6xU6a0gmI/zbuIdP.YEpOmBWempou1rlsEBzSlonMMc.",role:"revenda"},
            {id:67,username:"almam.comercial@gmail.com",password:"$2b$10$rQVPkd3Xjz7reQkIngo8lemDrwUoMqKX6tttJJvIMkrLmqZ7BYW3i",role:"revenda"},
            {id:68,username:"adm@chapferparafusos.com.br",password:"$2b$10$ylCYPDFx4N/.PIyfQDoN/ORSuCIWxcH8qAmGjjH2nf/IjqAj9/wtu",role:"revenda"},
            {id:69,username:"compras@riomaq.com.br",password:"$2b$10$iE5UBE8YCgutrport8KKSugiscKdp2N2fgEvWUPqqAmjBtP9b01Ye",role:"revenda"},
            {id:70,username:"marcio@meparmetais.com.br",password:"$2b$10$XBgWfYPw2XEPqyJEdzOlYukx40Z4foXQrTAsrYeqOX0xCo2ibkUJi",role:"revenda"},
            {id:71,username:"comercial3@fermarcsferramentas.com.br",password:"$2b$10$4n9nK5NqiNXVf.WnpWYf6uh9JKKjOQpmJn1lmZfGWc3CfOnbD9dR.",role:"revenda"},
            {id:72,username:"maxsoldascrt@gmail.com",password:"$2b$10$ji9G8BIiAzq3IyL6lw6L4OXWDGpwsUAyN7r30/X.P.NqhqQgQZK2a",role:"revenda"},
            {id:73,username:"comercial@servweld.com.br",password:"$2b$10$wPuZCQPuzWmHU5vtqtKA5ulmTVo8xfM2ahLqVTcJZY/TLjDxU/4mu",role:"revenda"},
            {id:74,username:"padovan@dsoldas.com.br",password:"$2b$10$hBa8LYrVVGLNv087WAIRAuDFjqvm5M9GvFEcGmRui7lySHOf8QnXm",role:"revenda"},
            {id:75,username:"atilio@alugaasolda.com.br",password:"$2b$10$xrm4imTYQBEh86n5Qe9IVuGoyUWQC8w1Df1FyLCknDs74nT3JD412",role:"revenda"},
            {id:76,username:"demilpinda@gmail.com",password:"$2b$10$1fB9jGiQ8MuqSzCOeSurv.6JIE0XXa1Ip/jeHvFlbsWhacsMSopY6",role:"revenda"},
            {id:77,username:"financeiro@wstsoldas.com.br",password:"$2b$10$nbfVUlXJoisHweuda5BC.OhKRgFuXmkBEkhmFwrFs9oQswyYpQrpW",role:"revenda"},
            {id:78,username:"metatronica.weld@gmail.com",password:"$2b$10$zJO2C51.L5nkr3x7Mbgaxeqi165W2NS1ZfrwACTy5TRBzwEfwTAie",role:"revenda"},
            {id:79,username:"André Coelho",password:"$2b$10$pEPDHE7ALctN8kM4Y5Vaxe01FOqS8n16U1XT2WLhQreJvGmrAUEhe",role:"adm"},
            {id:80,username:"Bruno Lemma",password:"$2b$10$6FJD1Miay9ijp0P1EXFm1OXhaaSbvIwSxeiHL0fLvT9Mxm0779Gxu",role:"adm"},
        ];

        for (const u of users) {
            await User.create(u);
        }
        // Reset sequence to max id
        await sequelize.query(`SELECT setval('"Users_id_seq"', (SELECT MAX(id) FROM "Users"))`);
        console.log(`Users: ${users.length} inseridos`);

        // Representantes
        const reps = [
            {user_id:2,email:"dovale.rep@gmail.com"},
            {user_id:3,email:"victor@vlmrepresentacoes.com.br"},
            {user_id:4,email:"fergeorgetto@gmail.com"},
            {user_id:5,email:"caio@pmancini.com.br"},
            {user_id:6,email:"carpanesehugo@gmail.com"},
            {user_id:7,email:"marquesrep@hotmail.com"},
            {user_id:8,email:"thepartnerrepresentacoes@gmail.com"},
            {user_id:9,email:"vendas.2@boxersoldas.com.br"},
            {user_id:10,email:"rodriguescostarepresentacoes@gmail.com"},
        ];
        await Representante.bulkCreate(reps);
        console.log(`Representantes: ${reps.length} inseridos`);

        // Revendas
        const revendas = [
            {user_id:13,cnpj:"66085473000147",cep:"13484332",cidade:"Limeira",estado:"SP",name:"Eletrosolda Limeira"},
            {user_id:14,cnpj:"51051811000233",cep:"13466000",cidade:"Americana",estado:"SP",name:"Luitex Americana"},
            {user_id:15,cnpj:"48996522000111",cep:"17052630",cidade:"Bauru",estado:"SP",name:"Suprimig Suprimentos Industriais"},
            {user_id:17,cnpj:"48239336000138",cep:"14803851",cidade:"Araraquara",estado:"SP",name:"Technofer"},
            {user_id:22,cnpj:"72738214000170",cep:"18043000",cidade:"Sorocaba",estado:"SP",name:"C. S. Ferramentas Ltda"},
            {user_id:23,cnpj:"31283413000154",cep:"18070671",cidade:"Sorocaba",estado:"SP",name:"Lt Comercio De Maquinas E Ferramentas Eireli, Ipanema Soldas"},
            {user_id:24,cnpj:"38401783000198",cep:"13424405",cidade:"Piracicaba",estado:"SP",name:"Comercial Soldas Piracicaba Ltda"},
            {user_id:25,cnpj:"03136028000149",cep:"13414032",cidade:"Piracicaba",estado:"SP",name:"Vr Abrasivos Ltda"},
            {user_id:26,cnpj:"57894164000127",cep:"13500120",cidade:"Rio Claro",estado:"SP",name:"Oxi-Rio"},
            {user_id:27,cnpj:"05159343000117",cep:"37701489",cidade:"Poços de Caldas",estado:"MG",name:"Alphabras"},
            {user_id:28,cnpj:"61258118000109",cep:"37860000",cidade:"Nova Resende",estado:"MG",name:"Ed Maq"},
            {user_id:29,cnpj:"30101262000103",cep:"37062650",cidade:"Varginha",estado:"MG",name:"Ferragista"},
            {user_id:30,cnpj:"07690525000145",cep:"14680000",cidade:"Jardinópolis",estado:"SP",name:"Santa Rita"},
            {user_id:31,cnpj:"56497993000103",cep:"13207070",cidade:"Jundiaí",estado:"SP",name:"Oxigênio Jundiaí"},
            {user_id:32,cnpj:"06135832000100",cep:"15076090",cidade:"São José do Rio Preto",estado:"SP",name:"Via Soldas"},
            {user_id:33,cnpj:"60661770000107",cep:"15045185",cidade:"São José do Rio Preto",estado:"SP",name:"Atual Equipamentos"},
            {user_id:34,cnpj:"13286416000160",cep:"15840000",cidade:"Itajobi",estado:"SP",name:"Coamassa"},
            {user_id:35,cnpj:"08262604000118",cep:"85803740",cidade:"Cascavel",estado:"PR",name:"Cascavel Soldas"},
            {user_id:36,cnpj:"72295793000124",cep:"87069013",cidade:"Maringá",estado:"PR",name:"Casa do Soldador"},
            {user_id:37,cnpj:"75104406000547",cep:"87507011",cidade:"Umuarama",estado:"PR",name:"A Bittencourt (Casa dos Parafusos)"},
            {user_id:38,cnpj:"18383568000102",cep:"85201504",cidade:"Pitanga",estado:"PR",name:"Ruzam Parafusos"},
            {user_id:39,cnpj:"06173829000172",cep:"85601275",cidade:"Francisco Beltrão",estado:"PR",name:"Schneider"},
            {user_id:40,cnpj:"03354828000136",cep:"86070545",cidade:"Londrina",estado:"PR",name:"Brasolda"},
            {user_id:41,cnpj:"20774440000103",cep:"84070460",cidade:"Ponta Grossa",estado:"PR",name:"Forte Soldas"},
            {user_id:42,cnpj:"79805172000192",cep:"87209052",cidade:"Cianorte",estado:"PR",name:"Trianorte"},
            {user_id:43,cnpj:"04798677000178",cep:"18406000",cidade:"Itapeva",estado:"SP",name:"Diafer Itapeva Matriz"},
            {user_id:44,cnpj:"73068462000114",cep:"16200260",cidade:"Birigui",estado:"SP",name:"Mil Máquinas"},
            {user_id:45,cnpj:"01985818000173",cep:"19013150",cidade:"Presidente Prudente",estado:"SP",name:"Total Soldas"},
            {user_id:46,cnpj:"59918136000128",cep:"16025285",cidade:"Araçatuba",estado:"SP",name:"Romapar"},
            {user_id:47,cnpj:"04274041000127",cep:"16400025",cidade:"Lins",estado:"SP",name:"LC Ferragens"},
            {user_id:48,cnpj:"29216373000186",cep:"17900000",cidade:"Dracena",estado:"SP",name:"Bismark"},
            {user_id:49,cnpj:"31897187000100",cep:"19063735",cidade:"Presidente Prudente",estado:"SP",name:"WMS"},
            {user_id:50,cnpj:"01615979000175",cep:"32110005",cidade:"Contagem",estado:"MG",name:"Locsoldas"},
            {user_id:51,cnpj:"72332794000100",cep:"88110600",cidade:"São José",estado:"SC",name:"Dominik"},
            {user_id:52,cnpj:"07527462000100",cep:"89803000",cidade:"Chapecó",estado:"SC",name:"Samta"},
            {user_id:53,cnpj:"81373441000130",cep:"89804000",cidade:"Chapecó",estado:"SC",name:"Maqdima"},
            {user_id:54,cnpj:"76842285000684",cep:"88304400",cidade:"Itajaí",estado:"SC",name:"Tamoyo Itajaí"},
            {user_id:55,cnpj:"00202741000155",cep:"89700025",cidade:"Concórdia",estado:"SC",name:"Ferpar"},
            {user_id:56,cnpj:"18242273000108",cep:"89460156",cidade:"São Bento do Sul",estado:"SC",name:"Fermaq São Bento do Sul"},
            {user_id:57,cnpj:"07960239000152",cep:"88930000",cidade:"Turvo",estado:"SC",name:"Certto Ferragens"},
            {user_id:58,cnpj:"01199326000152",cep:"88805086",cidade:"Criciúma",estado:"SC",name:"Tecmáquinas"},
            {user_id:59,cnpj:"46448438000138",cep:"88817045",cidade:"Içara",estado:"SC",name:"Casa das Ferramentas"},
            {user_id:60,cnpj:"32852328000122",cep:"88132772",cidade:"Palhoça",estado:"SC",name:"Ap Máquinas"},
            {user_id:61,cnpj:"15661668000157",cep:"89066300",cidade:"Blumenau",estado:"SC",name:"Kapdima"},
            {user_id:62,cnpj:"18830154000176",cep:"89172000",cidade:"Pouso Redondo",estado:"SC",name:"Febrazo"},
            {user_id:63,cnpj:"17079064000122",cep:"88503062",cidade:"Lages",estado:"SC",name:"Nazareno Soldas"},
            {user_id:64,cnpj:"82938325000184",cep:"89600000",cidade:"Joaçaba",estado:"SC",name:"Mattes"},
            {user_id:66,cnpj:"09467065000116",cep:"89900000",cidade:"São Miguel D'Oeste",estado:"SC",name:"Avantpar"},
            {user_id:67,cnpj:"28330312000182",cep:"88420000",cidade:"Agrolândia",estado:"SC",name:"Almam"},
            {user_id:68,cnpj:"35296616000136",cep:"89804025",cidade:"Chapecó",estado:"SC",name:"Chapefer"},
            {user_id:69,cnpj:"29459843000132",cep:"89163053",cidade:"Rio do Sul",estado:"SC",name:"Rio Máq"},
            {user_id:70,cnpj:"03996396000167",cep:"74919605",cidade:"Aparecida de Goiânia",estado:"GO",name:"Mepar"},
            {user_id:71,cnpj:"08615223000337",cep:"76400000",cidade:"Goianéisa",estado:"GO",name:"Fermarcs"},
            {user_id:72,cnpj:"04726418000131",cep:"73850000",cidade:"Cristalina",estado:"GO",name:"Max Soldas"},
            {user_id:73,cnpj:"11504286000169",cep:"71215226",cidade:"Brasília",estado:"DF",name:"Servweld"},
            {user_id:74,cnpj:"38081497000192",cep:"09121160",cidade:"Santo André",estado:"SP",name:"D. Soldas"},
            {user_id:75,cnpj:"61284618000115",cep:"06711250",cidade:"Cotia",estado:"SP",name:"AlugaASoldas"},
            {user_id:76,cnpj:"47569306000127",cep:"12420440",cidade:"Pindamonhangaba",estado:"SP",name:"Demil"},
            {user_id:77,cnpj:"53924644000132",cep:"09930270",cidade:"Diadema",estado:"SP",name:"WST"},
            {user_id:78,cnpj:"35466778000175",cep:"09182410",cidade:"Santo André",estado:"SP",name:"Metatrônica"},
        ];
        await Revenda.bulkCreate(revendas);
        console.log(`Revendas: ${revendas.length} inseridas`);

        // RD Token
        await RdToken.create({
            id: 1,
            access_token: "dlWGSI7KhGuHjvW28X0vJLIlVtmUTeqX",
            refresh_token: "r1tReya7zOd1BowTWqrpLhgm7MpfVlnG"
        });
        console.log("RdToken: 1 inserido");

        // Reset sequences
        await sequelize.query(`SELECT setval('"Negociacoes_id_seq"', 15, true)`);

        console.log("\nSeed concluído com sucesso!");
        process.exit(0);
    } catch (err) {
        console.error("Erro no seed:", err);
        process.exit(1);
    }
}

seed();
