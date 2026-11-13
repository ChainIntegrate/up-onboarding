// Creating an account: one call to LUKSO's LSP23LinkedContractsFactory that deploys the client's Universal
// Profile and its Key Manager and, through UniversalProfileInitPostDeploymentModule, writes the profile, LUKSO's
// LSP1 delegate and the client's keys with their permissions, then hands the profile to its Key Manager. The same
// mechanism as LUKSO's own tools.
//
// Used by the operator's page (web/operator.html) and by the creation service (tools/creator), so both build and
// check exactly the same thing:
//   UPDeploy.profileValue(lsp3Bytes, url)       the LSP3Profile value (VerifiableURI) of a JSON stored at url
//   UPDeploy.lsp3Json(profile, images)          the LSP3Profile JSON of a request's profile, images given as
//                                               [{ url, width, height, bytes }]
//   UPDeploy.plan({ profileValue, controllers, salt })
//                                               { keys, values, all, args, data }: what is written and the call
//   UPDeploy.addresses(provider, plan)          { up, km } the call will create
//   UPDeploy.verify(provider, plan, up, km, at) [] when the created profile is what the plan says, else problems
// No browser or Node specific code: ethers 6 only.
(function (root, factory) {
  const api = factory(root.ethers || (typeof require === "function" ? require("ethers").ethers : null));
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.UPDeploy = api;
})(typeof self !== "undefined" ? self : globalThis, function (ethers) {
  "use strict";
  // LUKSO's contracts, at the same address on LUKSO and its testnet (deterministic deployment).
  const FACTORY = "0x2300000A84D25dF63081feAa37ba6b62C4c89a30";      // LSP23LinkedContractsFactory
  const POST_MODULE = "0x000000000066093407b6704B89793beFfD0D8F00";  // UniversalProfileInitPostDeploymentModule
  const UP_IMPL = "0x3024D38EA2434BA6635003Dc1BDC0daB5882ED4F";      // UniversalProfileInit v0.14.0
  const KM_IMPL = "0x2Fe3AeD98684E7351aD2D408A43cE09a738BF8a4";      // LSP6KeyManagerInit v0.14.0
  const URD = "0x7870C5B8BC9572A8001C3f96f7ff59961B23500D";          // LSP1UniversalReceiverDelegateUP
  const INFRA = [["LSP23LinkedContractsFactory", FACTORY], ["UniversalProfileInitPostDeploymentModule", POST_MODULE],
    ["UniversalProfileInit", UP_IMPL], ["LSP6KeyManagerInit", KM_IMPL], ["LSP1UniversalReceiverDelegateUP", URD]];
  const DEPLOY_SELECTOR = "0x6a66a753";

  const LSP3_KEY = "0x5ef83ad9559033e6e941db7d7c495acdce616347d28e90c7ce47cbfcfcad3bc5";
  const URD_KEY = "0x0cfc51aec37c55a4d0b1a65c6255c4bf2fbdf6277f3cc0730c45b828b6db8b47";
  const ARRAY_KEY = "0xdf30dba06db6a30e65354d9a64c609861f089545ca58c6b4dbe31a5f338cb0e3"; // AddressPermissions[]
  const indexKey = (i) => ARRAY_KEY.slice(0, 34) + BigInt(i).toString(16).padStart(32, "0");
  const permKey = (a) => "0x4b80742de2bf82acb3630000" + a.slice(2).toLowerCase();
  const dataKeysKey = (a) => "0x4b80742de2bf866c29110000" + a.slice(2).toLowerCase();
  // A name for each key, as Cross_Chain's UP Wallet keeps it: bytes10(keccak256("UPWalletControllerName")) + 0000 + address.
  const nameKey = (a) => "0x344e172b69e28979f8df0000" + a.slice(2).toLowerCase();

  // Permissions. Administrator: what LUKSO's extension gives its main controller. Device: the extension's "access"
  // (shared/relay.js ACCESS_PERMS, maintainer's decision 2026-11-13): SUPER_CALL, SIGN, EXECUTE_RELAY_CALL and SETDATA
  // limited to its own name on the account; no transfer of value, no profile, no keys.
  // LSP1 delegate: REENTRANCY + SUPER_SETDATA + SETDATA, as LUKSO sets it.
  const ADMIN_PERMS = 0x7f3f06n;
  const DEVICE_PERMS = 0x400n | 0x40000n | 0x200000n | 0x400000n;
  const deviceDataKeys = (a) => ethers.concat(["0x0020", nameKey(a)]);
  const URD_PERMS = 0x60080n;

  const FACTORY_IFACE = new ethers.Interface([
    "function deployERC1167Proxies((bytes32 salt,uint256 fundingAmount,address implementationContract,bytes initializationCalldata) primary,(uint256 fundingAmount,address implementationContract,bytes initializationCalldata,bool addPrimaryContractAddress,bytes extraInitializationParams) secondary,address postDeploymentModule,bytes postDeploymentModuleCalldata) payable returns (address,address)",
    "function computeERC1167Addresses((bytes32 salt,uint256 fundingAmount,address implementationContract,bytes initializationCalldata) primary,(uint256 fundingAmount,address implementationContract,bytes initializationCalldata,bool addPrimaryContractAddress,bytes extraInitializationParams) secondary,address postDeploymentModule,bytes postDeploymentModuleCalldata) view returns (address,address)",
  ]);
  if (FACTORY_IFACE.getFunction("deployERC1167Proxies").selector !== DEPLOY_SELECTOR) throw new Error("LSP23 ABI mismatch");
  const UP_IFACE = new ethers.Interface(["function initialize(address)", "function getDataBatch(bytes32[]) view returns (bytes[])", "function owner() view returns (address)"]);
  const KM_IFACE = new ethers.Interface(["function target() view returns (address)"]);

  const cleanName = (v) => String(v || "").replace(/\s+/g, " ").trim().slice(0, 64);
  const nameValue = (v) => { const n = cleanName(v); return n ? ethers.hexlify(ethers.toUtf8Bytes(n)) : "0x"; };

  // The VerifiableURI of a JSON file: keccak256(utf8) of its bytes, then the URL.
  function profileValue(bytes, url) {
    return ethers.concat(["0x0000", "0x6f357c6a", "0x0020", ethers.keccak256(bytes), ethers.toUtf8Bytes(url)]);
  }
  // An image entry; `im.entries` keeps the entries of the current profile as they are (a profile update that
  // keeps the picture).
  const imageEntry = (im) => ({ width: im.width, height: im.height, url: im.url, verification: { method: "keccak256(bytes)", data: ethers.keccak256(im.bytes) } });
  const imageList = (im) => (!im ? [] : Array.isArray(im.entries) ? im.entries : [imageEntry(im)]);
  // The LSP3Profile JSON (a string) of a request's profile.
  function lsp3Json(profile, { avatar = null, cover = null } = {}) {
    return JSON.stringify({ LSP3Profile: {
      name: profile.name, description: profile.description, tags: profile.tags, links: profile.links,
      profileImage: imageList(avatar), backgroundImage: imageList(cover), avatar: [],
    } });
  }

  // What the post-deployment module writes, and the factory call. controllers: [{ address, name, role }].
  function plan({ profileValue: value, controllers, salt }) {
    if (!ethers.isHexString(salt, 32)) throw new Error("salt");
    const keys = [LSP3_KEY, URD_KEY], values = [value, URD];
    const all = [{ address: ethers.getAddress(URD), perms: URD_PERMS }].concat(controllers.map((c) => ({
      address: ethers.getAddress(c.address), name: c.name || "", role: c.role, perms: c.role === "admin" ? ADMIN_PERMS : DEVICE_PERMS,
    })));
    keys.push(ARRAY_KEY); values.push(ethers.toBeHex(all.length, 16));
    all.forEach((c, i) => {
      keys.push(indexKey(i)); values.push(c.address);
      keys.push(permKey(c.address)); values.push(ethers.zeroPadValue(ethers.toBeHex(c.perms), 32));
      if (c.role === "device") { keys.push(dataKeysKey(c.address)); values.push(deviceDataKeys(c.address)); }
      if (c.name) { keys.push(nameKey(c.address)); values.push(nameValue(c.name)); }
    });
    const postCalldata = ethers.AbiCoder.defaultAbiCoder().encode(["bytes32[]", "bytes[]"], [keys, values]);
    const args = [
      { salt, fundingAmount: 0n, implementationContract: UP_IMPL, initializationCalldata: UP_IFACE.encodeFunctionData("initialize", [POST_MODULE]) },
      { fundingAmount: 0n, implementationContract: KM_IMPL, initializationCalldata: "0xc4d66de8", addPrimaryContractAddress: true, extraInitializationParams: "0x" },
      POST_MODULE,
      postCalldata,
    ];
    return { keys, values, all, args, postCalldata, profileValue: value, to: FACTORY, data: FACTORY_IFACE.encodeFunctionData("deployERC1167Proxies", args) };
  }

  async function addresses(provider, p) {
    const [up, km] = await new ethers.Contract(FACTORY, FACTORY_IFACE, provider).computeERC1167Addresses(...p.args);
    return { up: ethers.getAddress(up), km: ethers.getAddress(km) };
  }

  // The LUKSO contracts missing on this network ([] when all are there).
  async function missingInfra(provider) {
    const out = [];
    for (const [name, addr] of INFRA) if ((await provider.getCode(addr)) === "0x") out.push(name);
    return out;
  }

  // Reads the created profile back: owned by its Key Manager, the Key Manager targeting it, the list of keys
  // and each one's permissions as planned, the profile value as planned. [] when everything matches.
  async function verify(provider, p, upAddr, kmAddr, at = {}) {
    const out = [];
    const up = new ethers.Contract(upAddr, UP_IFACE, provider);
    const km = new ethers.Contract(kmAddr, KM_IFACE, provider);
    const owner = await up.owner(at).catch(() => null);
    // getFunction: "target" is also the ethers Contract's own address property.
    const target = await km.getFunction("target")(at).catch(() => null);
    if (!owner || ethers.getAddress(owner) !== ethers.getAddress(kmAddr)) out.push(`owner ${owner}`);
    if (!target || ethers.getAddress(target) !== ethers.getAddress(upAddr)) out.push(`target ${target}`);
    const n = p.all.length;
    const read = await up.getDataBatch([LSP3_KEY, ARRAY_KEY, ...p.all.map((_, i) => indexKey(i)), ...p.all.map((c) => permKey(c.address))], at);
    if (String(read[0]).toLowerCase() !== p.profileValue.toLowerCase()) out.push("LSP3Profile");
    if (!read[1] || read[1] === "0x" || BigInt(read[1]) !== BigInt(n)) out.push(`list length ${read[1]}`);
    p.all.forEach((c, i) => {
      const item = read[2 + i], perms = read[2 + n + i];
      if (!item || item.toLowerCase() !== c.address.toLowerCase()) out.push(`key ${i} ${item}`);
      if (!perms || perms === "0x" || BigInt(perms) !== c.perms) out.push(`permissions ${i} ${perms}`);
    });
    return out;
  }

  return { FACTORY, POST_MODULE, UP_IMPL, KM_IMPL, URD, LSP3_KEY, ADMIN_PERMS, DEVICE_PERMS, profileValue, lsp3Json, plan, addresses, missingInfra, verify };
});
