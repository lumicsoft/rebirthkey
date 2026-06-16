let provider, signer, contract, usdtContract;
const CONTRACT_ADDRESS = "0x3113c4c27607CFaC95D817e5EeB642Bdf7dB02C9"; 
const USDT_ADDRESS = "0x3B66b1E08F55AF26c8eA14a73dA64b6bC8D799dE"; // Testnet USDT

window.userData = {
    currentPackageId: -1,
    isRegistered: false
};


const CONTRACT_ABI = [
 
    "function register(address _ref) external",
    "function buyPackage(uint256 _pkgId) external",
    "function withdraw() external",
    "function claimAllIncomes() external", 
    "function users(address) view returns (uint256 id, address referrer, uint256 registrationTime, uint256 balance, uint256 totalEarned, uint256 incomeCap, uint256 directCount, uint256 directIncome, uint256 levelIncome, uint256 singleLegIncome, uint256 matrixIncome, uint256 dailyIncome, uint256 rewardIncome, uint256 cappingLoss, uint256 fastTrackIncome, bool fastTrackEligible)",
    "function getTeamTree2x2(address _user) view returns (address level1_Left, address level1_Right, address level2_Pos1, address level2_Pos2, address level2_Pos3, address level2_Pos4)",
    "function getMatrixTree(uint256 _pkgId, uint256 _index) view returns (address ownerAddr, uint256 filledCount, uint256 ownerRebirths, address slotA, address slotB, address slotC)",
    "function getLatestMatrixNode(address _user, uint256 _pkgId) view returns (uint256 userMatrixIndex, address ownerAddr, uint256 filledCount, address slotA, address slotB, address slotC)",
    "function rebirthCount(address, uint256) view returns (uint256)",
   "function getUserIncomeHistory(address _user) view returns (tuple(uint256 amount, uint256 incomeType, uint256 time, address from, uint256 packageId)[])",
    "function getUserTotalData(address _user) view returns (uint256[9] stats, uint256[7] incomes, address ref)",
    "function getUserHistory(address _user) view returns (tuple(string txType, uint256 amount, uint256 timestamp, string detail)[])",
    "function packages(uint256) view returns (uint256 id, uint256 price, bool active)",
    "function getLevelTeamDetail(address _user, uint256 _level) view returns (tuple(address userAddress, uint256 registrationTime, uint256 currentPackageId, uint256 totalEarned)[])",
    "event IncomeReceived(address indexed user, uint256 amount, uint256 incomeType)",
    "event PackageBought(address indexed user, uint256 pkgId, uint256 amount)",
    "function getUserActivePackages(address _user) view returns (bool[12])",
    "function getAllMatrixHistory(address _user, uint256 _pkgId) view returns (tuple(uint256 index, uint256 filledCount, address slotA, address slotB, address slotC)[])",
    "function getUserWithdrawHistory(address _user) external view returns (tuple(uint256 totalAmount, uint256 netAmount, uint256 fee, uint256 time)[])",
    "function getPendingIncomeDetails(address _user) public view returns (uint256 pendingDailyPool, uint256 pendingLunar, uint256 pendingBoxer, uint256 pendingFastTrack)",
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


window.handleBuyPackage = async function(pkgId) {
    try {
       
        const selectedPkg = packageData.find(p => p.id === pkgId);
        
        if (!selectedPkg) {
            alert("Package not found!");
            return;
        }

        const price = ethers.utils.parseUnits(selectedPkg.price.toString(), 18);
        console.log(`Buying ${selectedPkg.name}: ${selectedPkg.price} USDT`);

        const usdtContract = new ethers.Contract(USDT_ADDRESS, USDT_ABI, window.signer);
        const userAddress = await window.signer.getAddress();
        
     
        const allowance = await usdtContract.allowance(userAddress, CONTRACT_ADDRESS);
        
     
        if (allowance.lt(price)) {
            console.log("Approving exact amount:", selectedPkg.price, "USDT");
            
           
            const btn = document.querySelector(`button[onclick*='handleBuyPackage(${pkgId})']`);
            if(btn) btn.innerText = "APPROVING...";

            const approveTx = await usdtContract.approve(CONTRACT_ADDRESS, price);
            await approveTx.wait();
        }
        
        const tx = await window.contract.buyPackage(pkgId);
        await tx.wait();
        
        alert(`${selectedPkg.name} purchased successfully!`);
        location.reload();
        
    } catch (err) { 
        console.error("Purchase Error:", err);
       
        if (err.code === 4001) {
            alert("Transaction cancelled by user.");
        } else {
            alert("Purchase failed: " + (err.reason || err.message));
        }
        location.reload();
    }
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
    const btn = document.getElementById('claim-btn');
    try {
        if(btn) { 
            btn.disabled = true; 
            btn.innerText = "PROCESSING..."; 
        }

        const tx = await window.contract.claimAllIncomes();
        console.log("Claiming rewards... TX:", tx.hash);
        
        await tx.wait();
        
        alert("Success! Rewards added to your main balance.");
        
        if(typeof fetchAllData === 'function') {
            const address = await window.signer.getAddress();
            await fetchAllData(address); 
        }

       
        if(typeof window.updatePendingRewardsUI === 'function') {
            await window.updatePendingRewardsUI();
        } else if(btn) {
            btn.disabled = false;
            btn.innerText = "CLAIM ALL NOW";
        }
        
    } catch (err) {
        console.error("Claim Error:", err);
        
        if (!(err instanceof TypeError && err.message.includes("updatePendingRewardsUI"))) {
            alert("Claim failed. Check console for details.");
        }

        if(typeof window.updatePendingRewardsUI === 'function') {
            window.updatePendingRewardsUI();
        } else if(btn) {
            btn.disabled = false;
            btn.innerText = "CLAIM ALL NOW";
        }
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

        const tempProvider = new ethers.providers.Web3Provider(window.ethereum);
        await tempProvider.send("eth_requestAccounts", []);
        signer = tempProvider.getSigner();
        contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
        const usdtContract = new ethers.Contract(USDT_ADDRESS, USDT_ABI, signer);
        
        const userAddress = await signer.getAddress();
        const refField = document.getElementById('reg-referrer');
        const referrerAddress = refField ? refField.value.trim() : "";
        
     
        const regAmount = ethers.utils.parseUnits("5", 18);

        if (!ethers.utils.isAddress(referrerAddress)) {
            alert("Please enter a valid Referrer Wallet Address (0x...)");
            return;
        }

        const btn = document.getElementById('reg-btn');
        if(btn) {
            btn.disabled = true;
            btn.innerText = "PROCESSING...";
        }

        const allowance = await usdtContract.allowance(userAddress, CONTRACT_ADDRESS);
        if (allowance.lt(regAmount)) {
            if(btn) btn.innerText = "APPROVE 5 USDT...";
            
      
            const estApproveGas = await usdtContract.estimateGas.approve(CONTRACT_ADDRESS, regAmount);
            
            const approveTx = await usdtContract.approve(CONTRACT_ADDRESS, regAmount, {
                gasLimit: estApproveGas.mul(130).div(100) 
            });
            await approveTx.wait();
        }
      

        if(btn) btn.innerText = "ESTIMATING GAS...";

        try {
            const estimatedGas = await contract.estimateGas.register(referrerAddress);
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
                alert("Please switch to BSC testnet!");
                return; 
            }
        }
        
        const userData = await contract.users(address);
        const isRegistered = userData.id.gt(0);
        const path = window.location.pathname;

        window.userData.isRegistered = isRegistered;

       
        if (!isRegistered) {
            if (!path.includes('register') && !path.includes('login')) {
                window.location.href = "register.html"; 
                return; 
            }
        } else {
           
            if (path.includes('register') || path.includes('login') || path.endsWith('index.html')) {
                window.location.href = "index1.html";
                return;
            }
        }

        updateNavbar(address);
        showLogoutIcon(address); 

        
        if (path.includes('index1')) {
            await fetchAllData(address);
        }

if (path.includes('referral') || path.includes('deposits')) {
    if (typeof initReferralPage === "function") {
        await initReferralPage();
    } else if (typeof initTeamPage === "function") {
        await initTeamPage();
    } else {
        console.log("Page specific init function not found - Skipping");
    }
}
       
        if (path.includes('deposits')) {
           
            if (typeof initTeamPage === "function") {
                await initTeamPage();
            } else {
               
                await fetchAllData(address); 
                if(window.loadTree) window.loadTree(address);
            }
        }

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


window.getIncomeHistory = async (userAddress) => {
    try {
        const activeContract = window.contract || contract;
        if (!activeContract) {
            console.error("Contract not initialized");
            return [];
        }

        console.log("Fetching history for:", userAddress);
        const historyData = await activeContract.getUserIncomeHistory(userAddress);
        
        if (!historyData || historyData.length === 0) return [];

     
        const formattedHistory = historyData.map((record, index) => {
            try {
               
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
        }).filter(item => item !== null);

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
        
        const data = await activeContract.getMatrixTree(pkgId, index);

       
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


window.getAllMatrixHistory = async function(userAddr, pkgId) {
    try {
        const activeContract = window.contract; 
        if (!activeContract) throw new Error("Contract not initialized");

        console.log("Fetching history for:", userAddr, "Pkg:", pkgId);

      
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
      
        return window.fallbackMatrixHistory(userAddr, pkgId);
    }
}


window.fallbackMatrixHistory = async function(userAddr, pkgId) {
    const activeContract = window.contract;
    const indices = []; 
    return []; 
}
async function fetchAllData(address) {
    // --- 1. Referral Link (Fail-safe, Sabse pehle) ---
    const refUrl = `${window.location.origin}/register.html?ref=${address}`; 
    const refInput = document.getElementById('refURL');
    if(refInput) refInput.value = refUrl;

    try {
        let activeContract = window.contract || contract;
        
        // --- 2. Data Fetching ---
        const data = await activeContract.getUserTotalData(address);
        const userData = await activeContract.users(address); 
        
        // --- Dashboard Stats Update ---
        updateText('user-id-display', "ID: #" + data.stats[0].toString());
        updateText('balance-large', format(data.stats[1])); 
        updateText('total-earned', format(data.stats[2]));
        updateText('income-cap', format(data.stats[3]) + " USDT");
        updateText('direct-count', data.stats[4].toString());
        updateText('capping-loss', format(data.stats[5])); 
        updateText('held-income', format(data.stats[6])); 

        // --- FIX: Safe access for Claimable Balance ---
        // Agar userData ya state define nahi hai, to 0 dikhaye
        const claimable = (userData && userData.state) ? userData.state.claimableBalance : 0;
        updateText('claimable-balance-display', format(claimable));

        // --- TOTAL INCOME STATISTICS ---
        updateText('lunar-fund', format(data.stats[7]));
        updateText('booster-fund', format(data.stats[8]));
        updateText('daily-earnings', format(data.incomes[4]));
        updateText('direct-earnings', format(data.incomes[0]));
        updateText('level-earnings', format(data.incomes[1]));
        updateText('single-leg-earnings', format(data.incomes[2])); 
        updateText('matrix-earnings', format(data.incomes[3]));
        updateText('reward-earnings', format(data.incomes[5]));

        if(data.incomes[6]) {
            updateText('fast-track-earnings', format(data.incomes[6]));
        }
      
        // --- 3. PENDING INCOME (Claim Logic) ---
        try {
            const pending = await activeContract.getPendingIncomeDetails(address);
            const pDaily = parseFloat(ethers.utils.formatEther(pending[0]));
            const pLunar = parseFloat(ethers.utils.formatEther(pending[1]));
            const pBoxer = parseFloat(ethers.utils.formatEther(pending[2]));
            const pFastTrack = pending[3] ? parseFloat(ethers.utils.formatEther(pending[3])) : 0;
            
            const totalP = pDaily + pLunar + pBoxer + pFastTrack;
            
            updateText('p-daily-val', pDaily.toFixed(2));
            updateText('p-lunar-val', pLunar.toFixed(2));
            updateText('p-boxer-val', pBoxer.toFixed(2));
            updateText('p-fast-track-val', pFastTrack.toFixed(2)); 
            
            const claimText = document.getElementById('pending-claim-text');
            if(claimText) claimText.innerText = `Pending: ${totalP.toFixed(2)} USDT`;
            
            const totalClaimVal = document.getElementById('total-pending-claim');
            if(totalClaimVal) totalClaimVal.innerText = totalP.toFixed(2);
            
            const claimBtn = document.getElementById('claim-btn');
            if(claimBtn) {
                claimBtn.disabled = totalP <= 0;
            }
        } catch(e) { console.log("Pending sub-fetch error:", e); }

        // --- 4. Package Logic ---
        let maxActive = -1;
        const activeStatusArray = await activeContract.getUserActivePackages(address);
        for (let i = 0; i < 12; i++) {
            if (activeStatusArray[i] === true) maxActive = i;
        }
        
        window.userData.currentPackageId = maxActive;
        if (typeof renderPackages === "function") renderPackages(maxActive);
        
        const rankHeader = document.getElementById('current-rank-header');
        if(rankHeader) {
            rankHeader.innerText = maxActive >= 0 ? "PACKAGE: G" + maxActive : "PACKAGE: NONE";
        }
    } catch (e) { 
        console.error("Fetch Data Global Error:", e); 
    }
}

window.syncPendingRewards = async function() {
    try {
        const activeContract = window.contract || contract;
        const address = await signer.getAddress();
        
       
        const pending = await activeContract.getPendingIncomeDetails(address);
        
        const pDaily = parseFloat(ethers.utils.formatEther(pending.pendingDailyPool || pending[0]));
        const pLunar = parseFloat(ethers.utils.formatEther(pending.pendingLunar || pending[1]));
        const pBoxer = parseFloat(ethers.utils.formatEther(pending.pendingBoxer || pending[2]));
        
        
        const pFastTrack = (pending.pendingFastTrack || pending[3]) ? 
                           parseFloat(ethers.utils.formatEther(pending.pendingFastTrack || pending[3])) : 0;
        
        const totalPending = pDaily + pLunar + pBoxer + pFastTrack;

       
        updateText('total-pending-val', totalPending.toFixed(2));
        updateText('p-daily-small', pDaily.toFixed(2));
        updateText('p-lunar-small', pLunar.toFixed(2));
        updateText('p-boxer-small', pBoxer.toFixed(2));
        
     
        updateText('p-fast-track-small', pFastTrack.toFixed(2)); 

       
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


