/* ============================================================================
   TD Experience - Exportar escena para el Mapa de luz
   ----------------------------------------------------------------------------
   Que hace: guarda en un archivo las posiciones de las luces, la camara y la
   caja del ambiente, para que la herramienta /mapa-de-luz/ calcule sola.

   Como se usa:
     1. En 3ds Max, SELECCIONAR solo dos cosas:
          - la camara del render
          - el plano o la caja del piso del ambiente
        Las luces NO hace falta seleccionarlas: toma siempre todas las de la
        escena que tengan archivo IES (el sol y el cielo quedan afuera solos).
        Si falta la camara o el piso, avisa antes de guardar.
     2. Scripting > Run Script... > elegir este archivo.
     3. Guardar el archivo en la carpeta mapa-de-luz\escenas del proyecto,
        con el nombre que usa la escena (ej. oficina-prueba-max.json).

   Supuesto: el piso del ambiente esta en Z = 0.
   El archivo se escribe sin acentos a proposito: 3ds Max puede leer mal los
   scripts con caracteres especiales.

   Nota tecnica: las funciones auxiliares van afuera de la principal. En
   MAXScript una funcion definida adentro de otra no puede llamar a sus
   vecinas ("No outer local variable references permitted").
   ============================================================================ */

fn mdlMetrosPorUnidad = (
  local f = case units.SystemType of (
    #inches:      0.0254
    #feet:        0.3048
    #miles:       1609.344
    #millimeters: 0.001
    #centimeters: 0.01
    #meters:      1.0
    #kilometers:  1000.0
    default:      1.0
  )
  f * units.SystemScale
)

fn mdlNum v = formattedPrint (v as float) format:".4f"

fn mdlVec p = "[" + (mdlNum p.x) + ", " + (mdlNum p.y) + ", " + (mdlNum p.z) + "]"

fn mdlEsc s = (
  local r = substituteString (s as string) "\\" "\\\\"
  substituteString r "\"" "\\\""
)

-- Busca el archivo IES en cualquier propiedad de la luz (Corona o fotometrica de Max)
fn mdlBuscarIES o = (
  local r = ""
  for p in (getPropNames o) do (
    local n = toLower (p as string)
    if (findString n "ies" != undefined or findString n "webfile" != undefined) do (
      local v = try (getProperty o p) catch undefined
      if classOf v == String and v != "" do r = v
    )
  )
  r
)

fn mdlIesActivo o = (
  local r = undefined
  for p in (getPropNames o) do (
    local n = toLower (p as string)
    if n == "ieson" or n == "ies_on" do r = try (getProperty o p) catch undefined
  )
  r
)

-- Giro alrededor de Z (en grados), a partir del eje X local de la luz
fn mdlGiroZ o = (
  local ax = o.transform.row1
  atan2 ax.y ax.x
)

-- Junta las luces de una lista de objetos y de todo lo que cuelga de ellos
-- (grupos, objetos vinculados). Asi alcanza con seleccionar el artefacto entero.
fn mdlJuntarLuces nodos lista = (
  for o in nodos do (
    if superClassOf o == light and findItem lista o == 0 do append lista o
    mdlJuntarLuces o.children lista
  )
  lista
)

fn exportarMapaDeLuz = (
  -- ---------------------------------------------------------------- juntar
  local sel = selection as array
  local luces = #()
  local cam = undefined
  local caja = undefined
  local mejorArea = 0.0
  local como = ""

  for o in sel do (
    local sc = superClassOf o
    if sc == camera then (if cam == undefined do cam = o)
    else if sc == GeometryClass and classOf o != Targetobject do (
      -- la caja del ambiente es la geometria seleccionada mas grande en planta
      local area = (o.max.x - o.min.x) * (o.max.y - o.min.y)
      if area > mejorArea do (mejorArea = area; caja = o)
    )
  )

  -- Luces: SIEMPRE todas las de la escena que tengan archivo IES, sin importar
  -- lo que este seleccionado (el sol, el cielo y las de relleno quedan afuera
  -- solas). Antes se usaba la seleccion y era facil exportar una sola luz por
  -- haberla dejado seleccionada. Las que quedan fuera del ambiente las descarta
  -- la herramienta usando la caja.
  for o in lights where superClassOf o == light and (mdlBuscarIES o) != "" do append luces o
  como = "todas las luces con IES de la escena"
  if cam == undefined do cam = viewport.getCamera()

  if luces.count == 0 do (
    messageBox "No encontre luces con archivo IES en la escena.\n\nRevisa que las Corona Light de los artefactos tengan cargado el IES." title:"Mapa de luz"
    return false
  )

  -- Sin camara o sin caja el calculo no sirve para la app: avisar antes de guardar
  local faltan = #()
  if cam == undefined do append faltan "la CAMARA del render"
  if caja == undefined do append faltan "la CAJA o plano del piso"
  if faltan.count > 0 do (
    local txt = "No encontre en la seleccion:\n"
    for x in faltan do txt += "  - " + x + "\n"
    txt += "\nSelecciona la camara y el piso del ambiente y volve a correr el script.\n\nGuardar igual?"
    if not (queryBox txt title:"Mapa de luz") do return false
  )

  -- ---------------------------------------------------------------- armar
  local ss = stringStream ""
  format "{\n" to:ss
  format "  \"_readme\": \"Exportado desde 3ds Max para la herramienta Mapa de luz. Se regenera corriendo tools/3dsmax/exportar-mapa-de-luz.ms.\",\n" to:ss
  format "  \"archivoMax\": \"%\",\n" (mdlEsc (maxFilePath + maxFileName)) to:ss
  format "  \"exportado\": \"%\",\n" (mdlEsc localTime) to:ss
  format "  \"unidades\": \"%\",\n" (units.SystemType as string) to:ss
  format "  \"metrosPorUnidad\": %,\n" (formattedPrint (mdlMetrosPorUnidad()) format:".6f") to:ss
  format "  \"render\": { \"ancho\": %, \"alto\": % },\n" renderWidth renderHeight to:ss

  local sinIES = 0
  format "  \"luces\": [\n" to:ss
  for i = 1 to luces.count do (
    local o = luces[i]
    local ies = mdlBuscarIES o
    if ies == "" do sinIES += 1
    local activo = mdlIesActivo o
    local activoTxt = if activo == undefined then "null" else (activo as string)
    local inten = try (o.intensity as string) catch ""
    local unid = try (o.intensityUnits as string) catch ""
    local dir = -o.transform.row3
    local coma = if i < luces.count then "," else ""
    format "    { \"nombre\": \"%\", \"clase\": \"%\", \"pos\": %, \"giroZ\": %, " (mdlEsc o.name) ((classOf o) as string) (mdlVec o.pos) (mdlNum (mdlGiroZ o)) to:ss
    format "\"apunta\": %, \"ies\": \"%\", \"iesActivo\": %, " (mdlVec dir) (mdlEsc ies) activoTxt to:ss
    format "\"intensidad\": \"%\", \"unidadIntensidad\": \"%\" }%\n" (mdlEsc inten) (mdlEsc unid) coma to:ss
  )
  format "  ],\n" to:ss

  if cam != undefined then (
    local objetivo = undefined
    if (try (isValidNode cam.target) catch false) then objetivo = cam.target.pos
    else (
      local d = try cam.targetDistance catch (try cam.target_distance catch 100.0)
      objetivo = cam.pos - cam.transform.row3 * d
    )
    local fov = try cam.fov catch 0.0
    format "  \"camara\": { \"nombre\": \"%\", \"pos\": %, " (mdlEsc cam.name) (mdlVec cam.pos) to:ss
    format "\"objetivo\": %, \"fovHorizontal\": % },\n" (mdlVec objetivo) (mdlNum fov) to:ss
  ) else (
    format "  \"camara\": null,\n" to:ss
  )

  if caja != undefined then (
    format "  \"caja\": { \"nombre\": \"%\", \"min\": %, \"max\": % }\n" (mdlEsc caja.name) (mdlVec caja.min) (mdlVec caja.max) to:ss
  ) else (
    format "  \"caja\": null\n" to:ss
  )
  format "}\n" to:ss

  -- ---------------------------------------------------------------- guardar
  local base = "C:\\Users\\Damian\\Desktop\\Borrar\\TD light experience\\mapa-de-luz\\escenas\\"
  if not (doesDirectoryExist base) do base = maxFilePath
  local ruta = getSaveFileName caption:"Guardar para el Mapa de luz" filename:(base + "oficina-prueba-max.json") types:"JSON (*.json)|*.json"
  if ruta == undefined do return false

  -- Freno: el archivo exportado tiene que terminar en "-max.json". Asi nunca pisa
  -- el archivo de configuracion de la escena (ej. oficina-prueba.json), que
  -- tiene los datos que no salen de Max (opticas, mascaras, textos de la app).
  if not (matchPattern ruta pattern:"*-max.json") do (
    messageBox ("El nombre tiene que terminar en -max.json\n(por ejemplo oficina-prueba-max.json).\n\nNo se guardo nada, asi no se pisa el archivo de la escena.") title:"Mapa de luz"
    return false
  )

  local f = try (createFile ruta encoding:#utf8 writeBOM:false) catch (createFile ruta)
  format "%" (ss as string) to:f
  close f

  local aviso = "Listo: " + (luces.count as string) + " luces (" + como + ")"
  aviso += (if cam != undefined then ", camara \"" + cam.name + "\"" else ", SIN camara")
  aviso += (if caja != undefined then ", caja \"" + caja.name + "\"" else ", sin caja")
  if sinIES > 0 do aviso += "\n\nOjo: " + (sinIES as string) + " luces no tienen archivo IES."
  aviso += "\n\nGuardado en:\n" + ruta
  messageBox aviso title:"Mapa de luz"
  true
)

exportarMapaDeLuz()
