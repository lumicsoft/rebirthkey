let provider, signer, contract, usdtContract;
const CONTRACT_ADDRESS = "0x35bE1537a12876Bd22C930269089D42Abc54138B"; 
const USDT_ADDRESS = "0x3B66b1E08F55AF26c8eA14a73dA64b6bC8D799dE"; // Testnet USDT

// --- GLOBAL DATA OBJECT FOR DASHBOARD SYNC ---
window.userData = {
    currentPackageId: -1,
    isRegistered: false
};

// --- NEW ABI FOR REBIRTHKEY CONTRACT ---
const CONTRACT_ABI = [
 
    "function register(address _ref) external",
    "function buyPackage(uint256 _pkgId) external",
    "function withdraw() external",
    "function claimAllIncomes() external", 
    "function users(address) view returns (uint256 id, address referrer, uint256 registrationTime, uint256 balance, uint256 totalEarned, uint256 incomeCap, uint256 directCount, uint256 directIncome, uint256 levelIncome, uint256 singleLegIncome, uint256 matrixIncome, uint256 dailyIncome, uint256 rewardIncome, uint256 cappingLoss)",
    "function getTeamTree2x2(address _user) view returns (address level1_Left, address level1_Right, address level2_Pos1, address level2_Pos2, address level2_Pos3, address level2_Pos4)",
    "function getMatrixTree(uint256 _pkgId, uint256 _index) view returns (address ownerAddr, uint256 filledCount, uint256 ownerRebirths, address slotA, address slotB, address slotC)",
    "function getLatestMatrixNode(address _user, uint256 _pkgId) view returns (uint256 userMatrixIndex, address ownerAddr, uint256 filledCount, address slotA, address slotB, address slotC)",
    "function rebirthCount(address, uint256) view returns (uint256)",
   "function getUserIncomeHistory(address _user) view returns (tuple(uint256 amount, uint256 incomeType, uint256 time, address from, uint256 packageId)[])",
    "function getUserTotalData(address _user) view returns (uint256[9] stats, uint256[6] incomes, address ref)",
    "function getUserHistory(address _user) view returns (tuple(string txType, uint256 amount, uint256 timestamp, string detail)[])",
    "function packages(uint256) view returns (uint256 id, uint256 price, bool active)",
    "function getLevelTeamDetail(address _user, uint256 _level) view returns (tuple(address userAddress, uint256 registrationTime, uint256 currentPackageId, uint256 totalEarned)[])",
    "event IncomeReceived(address indexed user, uint256 amount, uint256 incomeType)",
    "event PackageBought(address indexed user, uint256 pkgId, uint256 amount)",
    "function getUserActivePackages(address _user) view returns (bool[12])",
    "function getAllMatrixHistory(address _user, uint256 _pkgId) view returns (tuple(uint256 index, uint256 filledCount, address slotA, address slotB, address slotC)[])",
    "function getUserWithdrawHistory(address _user) external view returns (tuple(uint256 totalAmount, uint256 netAmount, uint256 fee, uint256 time)[])",
    "function getPendingIncomeDetails(address _user) public view returns (uint256 pendingDailyPool, uint256 pendingLunar, uint256 pendingBoxer)",
];

const USDT_ABI = [
    "function approve(address spender, uint256 amount) external returns (bool)",
    "function allowance(address owner, address spender) external view returns (uint256)",
    "function balanceOf(address account) external view returns (uint256)"
];

// --- 1. NEW: AUTO-FILL LOGIC ---
function checkReferralURL() {
    const urlParams = new URLSearchParams(window.location.search);
    const refAddr = urlParams.get('ref');
    const refField = document.getElementById('reg-referrer');

    if (refAddr && ethers.utils.isAddress(refAddr) && refField) {
        refField.value = refAddr;
        console.log("Referral address auto-filled:", refAddr);
    }
}

// --- INITIALIZATION ---
async function init() {
    checkReferralURL();
    if (window.ethereum) {
        try {
            provider = new ethers.providers.Web3Provider(window.ethereum, "any");
            const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
            
            window.signer = provider.getSigner();
            signer = window.signer;
            window.contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
            contract = window.contract;

            if (accounts && accounts.length > 0) {
                if (localStorage.getItem('manualLogout') !== 'true') {
                    await setupApp(accounts[0]);
                } else {
                    updateNavbar(accounts[0]);
                }
            }
        } catch (error) { 
            console.error("Init Error", error); 
        }
    } else { 
        alert("Wallet not detected! Please open this site inside Trust Wallet or MetaMask browser."); 
    }
}

// --- CORE LOGIC ---
window.handleBuyPackage = async function(pkgId) {
    try {
        const pkg = await contract.packages(pkgId);
        const price = pkg.price;
        
        const usdtContract = new ethers.Contract(USDT_ADDRESS, USDT_ABI, signer);
        const userAddress = await signer.getAddress();
        
        // 1. Check Allowance
        const allowance = await usdtContract.allowance(userAddress, CONTRACT_ADDRESS);
        if (allowance.lt(price)) {
            const approveTx = await usdtContract.approve(CONTRACT_ADDRESS, ethers.constants.MaxUint256);
            await approveTx.wait();
        }
        
        // 2. Buy Package
        const tx = await contract.buyPackage(pkgId);
        await tx.wait();
        alert("Package purchased successfully!");
        location.reload();
    } catch (err) { alert("Purchase failed: " + (err.reason || err.message)); }
}

window.handleWithdraw = async function() {
    try {
        const tx = await contract.withdraw();
        await tx.wait();
        alert("Withdrawal successful!");
        location.reload();
    } catch (err) { alert("Withdraw failed: " + (err.reason || err.message)); }
}
window.handleClaimRewards = async function() {
    try {
        const btn = document.getElementById('claim-btn');
        if(btn) { 
            btn.disabled = true; 
            btn.innerText = "PROCESSING..."; 
        }

        // Exact function from your Part 2 code
        const tx = await window.contract.claimAllIncomes();
        console.log("Claiming rewards... TX:", tx.hash);
        
        await tx.wait();
        
        alert("Success! Rewards added to your main balance.");
        
        // Data Refresh
        if(typeof fetchAllData === 'function') {
            const address = await signer.getAddress();
            await fetchAllData(address); 
        }
        await window.updatePendingRewardsUI();
        
    } catch (err) {
        console.error("Claim Error:", err);
        alert("Claim failed. Check console for details.");
        window.updatePendingRewardsUI(); // Reset button state
    }
}

window.handleLogin = async function() {
    try {
        if (!window.ethereum) return alert("Please install MetaMask!");
        const accounts = await provider.send("eth_requestAccounts", []);
        if (accounts.length === 0) return;
        
        const userAddress = accounts[0]; 
        signer = provider.getSigner();
        contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
        localStorage.removeItem('manualLogout');
        
        const userData = await contract.users(userAddress);
        if (userData.id.gt(0)) {
            if(typeof showLogoutIcon === "function") showLogoutIcon(userAddress);
            window.location.href = "index1.html";
        } else {
            alert("This wallet is not registered!");
            window.location.href = "register.html";
        }
    } catch (err) {
        console.error("Login Error:", err);
        alert("Login failed! Make sure you are on BSC Testnet.");
    }
}

window.handleRegister = async function() {
    try {
        if (!window.ethereum) {
            alert("MetaMask or Trust Wallet not found!");
            return;
        }

        // 1. Initial Setup
        const tempProvider = new ethers.providers.Web3Provider(window.ethereum);
        await tempProvider.send("eth_requestAccounts", []);
        signer = tempProvider.getSigner();
        contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
        const usdtContract = new ethers.Contract(USDT_ADDRESS, USDT_ABI, signer);
        
        const userAddress = await signer.getAddress();
        const refField = document.getElementById('reg-referrer');
        const referrerAddress = refField ? refField.value.trim() : "";
        const regAmount = ethers.utils.parseUnits("5", 18);

        // 2. Validations
        if (!ethers.utils.isAddress(referrerAddress)) {
            alert("Please enter a valid Referrer Wallet Address (0x...)");
            return;
        }

        const btn = document.getElementById('reg-btn');
        if(btn) {
            btn.disabled = true;
            btn.innerText = "PROCESSING...";
        }

        // 3. --- SMART USDT APPROVAL ---
        const allowance = await usdtContract.allowance(userAddress, CONTRACT_ADDRESS);
        if (allowance.lt(regAmount)) {
            if(btn) btn.innerText = "APPROVE USDT...";
            
            // Approval ke liye bhi gas estimate kar rahe hain
            const estApproveGas = await usdtContract.estimateGas.approve(CONTRACT_ADDRESS, ethers.constants.MaxUint256);
            
            const approveTx = await usdtContract.approve(CONTRACT_ADDRESS, ethers.constants.MaxUint256, {
                gasLimit: estApproveGas.mul(130).div(100) // 30% Buffer
            });
            await approveTx.wait();
        }

        // 4. --- DYNAMIC GAS ESTIMATION FOR REGISTER ---
        if(btn) btn.innerText = "ESTIMATING GAS...";

        try {
            // Contract se pucho ki is transaction mein kitni gas lagegi
            const estimatedGas = await contract.estimateGas.register(referrerAddress);
            
            // 30% Buffer lagana (Safe side ke liye)
            const gasLimitWithBuffer = estimatedGas.mul(130).div(100); 
            
            console.log("Estimated Gas:", estimatedGas.toString());
            console.log("Gas with 30% Buffer:", gasLimitWithBuffer.toString());

            if(btn) btn.innerText = "CONFIRM IN WALLET...";

            const tx = await contract.register(referrerAddress, {
                gasLimit: gasLimitWithBuffer
            });

            alert("Transaction sent! Waiting for confirmation...");
            const receipt = await tx.wait();

            if (receipt.status === 1) {
                alert("Registration Successful!");
                window.location.href = "index1.html";
            }
        } catch (gasErr) {
            // Agar estimateGas fail hota hai, matlab transaction contract level pe fail ho rahi hai (e.g. already registered)
            console.error("Gas Estimation Failed:", gasErr);
            throw new Error("Transaction would fail. Check if you are already registered or have enough BNB for gas.");
        }

    } catch (err) {
        console.error("Detailed Error:", err);
        const btn = document.getElementById('reg-btn');
        if(btn) {
            btn.disabled = false;
            btn.innerText = "REGISTER NOW";
        }
        alert("Error: " + (err.reason || err.message));
    }
}

window.handleLogout = function() {
    if (confirm("Do you want to disconnect?")) {
        localStorage.setItem('manualLogout', 'true');
        signer = null;
        contract = null;
        window.location.href = "index.html";
    }
}

function showLogoutIcon(address) {
    const btn = document.getElementById('connect-btn');
    const logout = document.getElementById('logout-icon-btn');
    if (btn) btn.innerText = address.substring(0, 6) + "..." + address.substring(38);
    if (logout) { logout.style.display = 'flex'; }
}

// --- APP SETUP ---
// --- APP SETUP ---
async function setupApp(address) {
    try {
        const network = await provider.getNetwork();
        if (network.chainId !== 97) { 
            try {
                await window.ethereum.request({
                    method: 'wallet_switchEthereumChain',
                    params: [{ chainId: '0x61' }],
                });
            } catch (err) {
                alert("Please switch to BSC Testnet!");
                return; 
            }
        }
        
        const userData = await contract.users(address);
        const isRegistered = userData.id.gt(0);
        const path = window.location.pathname;

        window.userData.isRegistered = isRegistered;

        // Redirect logic for unregistered users
        if (!isRegistered) {
            if (!path.includes('register') && !path.includes('login')) {
                window.location.href = "register.html"; 
                return; 
            }
        } else {
            // Redirect logic for registered users (avoid login/register pages)
            if (path.includes('register') || path.includes('login') || path.endsWith('index.html')) {
                window.location.href = "index1.html";
                return;
            }
        }

        updateNavbar(address);
        showLogoutIcon(address); 

        // Dashboard Path
        if (path.includes('index1')) {
            await fetchAllData(address);
        }
// Is block ko replace karein
if (path.includes('referral') || path.includes('deposits')) {
    if (typeof initReferralPage === "function") {
        await initReferralPage();
    } else if (typeof initTeamPage === "function") {
        await initTeamPage();
    } else {
        console.log("Page specific init function not found - Skipping");
    }
}
        // --- UPDATED: DEPOSITS PAGE PATH ---
        if (path.includes('deposits')) {
            // Agar deposits.html par initTeamPage() ya koi specific initialization hai
            if (typeof initTeamPage === "function") {
                await initTeamPage();
            } else {
                // Fallback: Data load karega aur agar tree function available hai to trigger karega
                await fetchAllData(address); 
                if(window.loadTree) window.loadTree(address);
            }
        }

        // History Path
        if (path.includes('history')) {
            window.showHistory('deposit');
        }

    } catch (e) {
        console.error("SetupApp Error:", e);
    }
}
// --- HISTORY LOGIC ---
window.showHistory = async function(type) {
    const container = document.getElementById('history-container');
    if(!container) return;
    container.innerHTML = `<div class="p-10 text-center text-yellow-500 italic">Blockchain Syncing...</div>`;
    
    const logs = await window.fetchBlockchainHistory(type);
    if (logs.length === 0) {
        container.innerHTML = `<div class="p-10 text-center text-gray-500">No transactions found.</div>`;
        return;
    }

    container.innerHTML = logs.map(item => `
        <div class="bg-white/5 border border-white/10 rounded-2xl p-4 mb-4 flex justify-between items-center">
            <div>
                <h4 class="font-bold ${item.color}">${item.type}</h4>
                <p class="text-xs text-gray-400">${item.date} | ${item.time}</p>
            </div>
            <div class="text-right">
                <span class="text-lg font-black text-white">${item.amount}</span>
                <p class="text-[10px] text-gray-500 italic uppercase">Completed</p>
            </div>
        </div>
    `).join('');
}
// web3-handler.js mein add karein

window.getIncomeHistory = async (userAddress) => {
    try {
        // Ensure contract is available
        const activeContract = window.contract || contract;
        if (!activeContract) {
            console.error("Contract not initialized");
            return [];
        }

        console.log("Fetching history for:", userAddress);
        const historyData = await activeContract.getUserIncomeHistory(userAddress);
        
        if (!historyData || historyData.length === 0) return [];

        // Formatting with Double-Check (Index vs Name)
        const formattedHistory = historyData.map((record, index) => {
            try {
                // Ethers.js sometimes returns named properties, sometimes indexed.
                // We use || to support both scenarios.
                const amountRaw = record.amount || record[0];
                const typeRaw = record.incomeType || record[1];
                const timeRaw = record.time || record[2];
                const fromRaw = record.from || record[3];
                const pkgRaw = record.packageId || record[4];

                return {
                    amount: ethers.utils.formatEther(amountRaw.toString()),
                    incomeType: Number(typeRaw.toString()),
                    time: Number(timeRaw.toString()),
                    from: fromRaw,
                    packageId: Number(pkgRaw.toString()),
                    index: index + 1
                };
            } catch (innerErr) {
                console.warn("Record mapping error at index", index, innerErr);
                return null;
            }
        }).filter(item => item !== null); // Remove failed records

        // Sort by time (Newest First)
        return formattedHistory.sort((a, b) => b.time - a.time);
        
    } catch (e) {
        console.error("Critical Web3 Handler History Error:", e);
        return [];
    }
}
window.fetchBlockchainHistory = async function(type) {
    try {
        const activeSigner = window.signer || signer;
        const activeContract = window.contract || contract;
        const address = await activeSigner.getAddress();
        const rawHistory = await activeContract.getUserHistory(address);
        
        return rawHistory.map(item => {
            const dt = new Date(item.timestamp.toNumber() * 1000);
            return {
                type: item.txType,
                amount: format(item.amount),
                date: dt.toLocaleDateString(),
                time: dt.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
                ts: item.timestamp.toNumber(),
                color: 'text-cyan-400'
            };
        }).sort((a, b) => b.ts - a.ts);
    } catch (e) { return []; }
}

// --- TREE & MATRIX ---
window.load2x2Tree = async function(userAddr) {
    try {
        const tree = await contract.getTeamTree2x2(userAddr);
        const updateNode = (id, addr) => {
            const el = document.getElementById(id);
            if (!el) return;
            if (addr && addr !== ethers.constants.AddressZero) {
                el.innerText = addr.substring(0, 6) + "...";
                el.classList.add('active-node');
            } else {
                el.innerText = "Empty";
                el.classList.remove('active-node');
            }
        };
        updateNode('lvl1-L', tree.level1_Left);
        updateNode('lvl1-R', tree.level1_Right);
        updateNode('lvl2-1', tree.level2_Pos1);
        updateNode('lvl2-2', tree.level2_Pos2);
        updateNode('lvl2-3', tree.level2_Pos3);
        updateNode('lvl2-4', tree.level2_Pos4);
    } catch (e) { console.error("Tree Error", e); }
}
// --- SPECIFIC MATRIX NODE FETCH ---
window.loadSpecificMatrixNode = async function(pkgId, index) {
    try {
        const activeContract = window.contract || contract;
        
        // Calling the function you added to ABI
        const data = await activeContract.getMatrixTree(pkgId, index);

        // Data Structure mapping
        return {
            owner: data.ownerAddr,
            filledCount: data.filledCount.toNumber(),
            rebirths: data.ownerRebirths.toNumber(),
            slots: [data.slotA, data.slotB, data.slotC]
        };
    } catch (e) {
        console.error("Matrix Tree Fetch Error:", e);
        return null;
    }
}

// --- NEW: FETCH ALL HISTORY (For the History Page) ---
window.getAllMatrixHistory = async function(userAddr, pkgId) {
    try {
        // Check karein ki contract object sahi se initialize hai
        const activeContract = window.contract; 
        if (!activeContract) throw new Error("Contract not initialized");

        console.log("Fetching history for:", userAddr, "Pkg:", pkgId);

        // Seedha contract call karein (Kyunki ye function contract me hai)
        const history = await activeContract.getAllMatrixHistory(userAddr, pkgId);
        
        return history.map(node => ({
            index: node.index.toString(),
            filledCount: node.filledCount.toString(),
            slotA: node.slotA,
            slotB: node.slotB,
            slotC: node.slotC
        }));

    } catch (e) {
        console.error("Matrix History Fetch Error:", e);
        // Agar function nahi mil raha, to fallback loop chalayein (Safety ke liye)
        return window.fallbackMatrixHistory(userAddr, pkgId);
    }
}

// Ye backup function hai agar ABI mismatch ho jaye
window.fallbackMatrixHistory = async function(userAddr, pkgId) {
    const activeContract = window.contract;
    const indices = []; // Yahan aap loop chala kar data nikal sakte hain jaise pichle message me bataya
    return []; 
}
// --- GLOBAL DATA FETCH (UPDATED FOR INDIVIDUAL TOTALS) ---
async function fetchAllData(address) {
    try {
        let activeContract = window.contract || contract;
        
        // stats index mapping as per Solidity: 
        // 0:id, 1:balance, 2:totalEarned, 3:incomeCap, 4:directCount, 5:cappingLoss, 6:heldIncome, 7:lunar, 8:boxer
        const data = await activeContract.getUserTotalData(address);
        
        // --- Dashboard Stats Update ---
        updateText('user-id-display', "ID: #" + data.stats[0].toString());
        updateText('balance-large', format(data.stats[1])); 
        updateText('total-earned', format(data.stats[2]));
        updateText('income-cap', format(data.stats[3]) + " USDT");
        updateText('direct-count', data.stats[4].toString());
        updateText('capping-loss', format(data.stats[5])); 
        updateText('held-income', format(data.stats[6])); 

        // --- TOTAL INCOME STATISTICS (अलग-अलग दिखाने के लिए) ---
        
        // 1. Lunar Fund (Solidity stats[7]) -> ID: lunar-fund
        updateText('lunar-fund', format(data.stats[7]));
        
        // 2. Booster Fund (Solidity stats[8]) -> ID: booster-fund
        updateText('booster-fund', format(data.stats[8]));

        // 3. Daily Income (Solidity incomes[4]) -> ID: daily-earnings
        updateText('daily-earnings', format(data.incomes[4]));

        // --- बाकी की Incomes (Incomes array mapping) ---
        updateText('direct-earnings', format(data.incomes[0]));
        updateText('level-earnings', format(data.incomes[1]));
        updateText('single-leg-earnings', format(data.incomes[2])); 
        updateText('matrix-earnings', format(data.incomes[3]));
        updateText('reward-earnings', format(data.incomes[5]));

        // --- Referral Logic ---
        const refUrl = `${window.location.origin}/register.html?ref=${address}`; 
        const refInput = document.getElementById('refURL');
        if(refInput) refInput.value = refUrl;

        // --- Pending Rewards Check (for Claim Button UI) ---
        try {
            const pending = await activeContract.getPendingIncomeDetails(address);
            // pending.pendingDailyPool, pending.pendingLunar, pending.pendingBoxer
            const totalP = parseFloat(ethers.utils.formatEther(pending[0])) + 
                          parseFloat(ethers.utils.formatEther(pending[1])) + 
                          parseFloat(ethers.utils.formatEther(pending[2]));
            
            const claimText = document.getElementById('pending-claim-text');
            if(claimText) claimText.innerText = `Pending: ${totalP.toFixed(2)} USDT`;
            
            // Main Claim Center Balance
            const totalClaimVal = document.getElementById('total-pending-claim');
            if(totalClaimVal) totalClaimVal.innerText = totalP.toFixed(2);
            
        } catch(e) { console.log("Pending sub-fetch error:", e); }

        // --- Package Status Update ---
        let maxActive = -1;
        const activeStatusArray = await activeContract.getUserActivePackages(address);
        for (let i = 0; i < 12; i++) {
            if (activeStatusArray[i] === true) maxActive = i;
        }
        
        window.userData.currentPackageId = maxActive;
        if (typeof renderPackages === "function") renderPackages(maxActive);

        const rankHeader = document.getElementById('current-rank-header');
        if(rankHeader) rankHeader.innerText = maxActive >= 0 ? "V" + (maxActive + 1) : "No Rank";

    } catch (e) { 
        console.error("Fetch Data Global Error:", e); 
    }
}
// --- NEW: PENDING INCOME SYNC & UI UPDATE ---
window.syncPendingRewards = async function() {
    try {
        const activeContract = window.contract || contract;
        const address = await signer.getAddress();
        
        // Contract function call: getPendingIncomeDetails
        const pending = await activeContract.getPendingIncomeDetails(address);
        
        // Ethers se readable format mein convert karein
        const pDaily = parseFloat(ethers.utils.formatEther(pending.pendingDailyPool));
        const pLunar = parseFloat(ethers.utils.formatEther(pending.pendingLunar));
        const pBoxer = parseFloat(ethers.utils.formatEther(pending.pendingBoxer));
        
        const totalPending = pDaily + pLunar + pBoxer;

        // UI Par values update karein
        updateText('total-pending-val', totalPending.toFixed(2));
        updateText('p-daily-small', pDaily.toFixed(2));
        updateText('p-lunar-small', pLunar.toFixed(2));
        updateText('p-boxer-small', pBoxer.toFixed(2));

        // Claim Button Status logic
        const claimBtn = document.getElementById('claim-btn');
        if (claimBtn) {
            if (totalPending <= 0) {
                claimBtn.disabled = true;
                claimBtn.innerText = "NO REWARDS";
                claimBtn.classList.add('opacity-50', 'grayscale');
            } else {
                claimBtn.disabled = false;
                claimBtn.innerText = "CLAIM ALL NOW";
                claimBtn.classList.remove('opacity-50', 'grayscale');
            }
        }
    } catch (e) {
        console.error("Sync Pending Error:", e);
    }
}
// --- UTILS ---
const format = (val) => {
    try { 
        if (!val) return "0.0000"; 
        return parseFloat(ethers.utils.formatUnits(val, 18)).toFixed(4);
    } catch (e) { return "0.0000"; }
};

const updateText = (id, val) => { const el = document.getElementById(id); if(el) el.innerText = val; };

function updateNavbar(addr) {
    const btn = document.getElementById('connect-btn');
    if(btn) btn.innerText = addr.substring(0,6) + "..." + addr.substring(38);
}

if (window.ethereum) {
    window.ethereum.on('accountsChanged', () => {
        localStorage.removeItem('manualLogout');
        location.reload();
    });
    window.ethereum.on('chainChanged', () => location.reload());
}

window.addEventListener('load', init);





























