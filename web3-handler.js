let provider, signer, contract, usdtContract;
const CONTRACT_ADDRESS = "0x453F54E96667D07BaB8d7540Ed1a06aC2691141F"; 
const USDT_ADDRESS = "0x3B66b1E08F55AF26c8eA14a73dA64b6bC8D799dE"; // Testnet USDT

// --- NEW ABI FOR REBIRTHKEY CONTRACT ---
const CONTRACT_ABI = [
    "function register(address _ref) external",
    "function buyPackage(uint256 _pkgId) external",
    "function withdraw() external",
    "function users(address) view returns (uint256 id, address referrer, uint256 registrationTime, uint256 balance, uint256 totalEarned, uint256 incomeCap, uint256 directCount, uint256 directIncome, uint256 levelIncome, uint256 singleLegIncome, uint256 matrixIncome, uint256 dailyIncome, uint256 rewardIncome, uint256 cappingLoss)",
    "function getTeamTree2x2(address _user) view returns (address level1_Left, address level1_Right, address level2_Pos1, address level2_Pos2, address level2_Pos3, address level2_Pos4)",
    "function getMatrixTree(uint256 _pkgId, uint256 _index) view returns (address ownerAddr, uint256 filledCount, uint256 ownerRebirths, address slotA, address slotB, address slotC)",
    "function getUserTotalData(address _user) view returns (uint256[6] stats, uint256[6] incomes, address ref)",
    "function getUserHistory(address _user) view returns (tuple(string txType, uint256 amount, uint256 timestamp, string detail)[])",
    "function packages(uint256) view returns (uint256 id, uint256 price, bool active)"
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
        // Naye contract mein id 0 se badi matlab registered
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
    console.log("Register function started...");
    
    try {
        // 1. Check if Provider exists
        if (!window.ethereum) {
            alert("MetaMask or Trust Wallet not found!");
            return;
        }

        // 2. Re-initialize if signer is missing
        if (!signer) {
            const tempProvider = new ethers.providers.Web3Provider(window.ethereum);
            await tempProvider.send("eth_requestAccounts", []);
            signer = tempProvider.getSigner();
            contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
        }

        const userAddress = await signer.getAddress();
        const refField = document.getElementById('reg-referrer');
        const referrerAddress = refField ? refField.value.trim() : "";

        // 3. Validation
        if (!ethers.utils.isAddress(referrerAddress)) {
            alert("Please enter a valid Referrer Wallet Address (0x...)");
            return;
        }

        if (referrerAddress.toLowerCase() === userAddress.toLowerCase()) {
            alert("You cannot refer yourself!");
            return;
        }

        console.log("Registering:", userAddress, "with Ref:", referrerAddress);

        // 4. Update Button UI
        const btn = document.getElementById('reg-btn');
        if(btn) {
            btn.disabled = true;
            btn.innerText = "CONFIRMING IN WALLET...";
        }

        // 5. Send Transaction with Manual Gas Limit (Zaruri hai failure rokne ke liye)
        const tx = await contract.register(referrerAddress, {
            gasLimit: 400000 
        });

        alert("Transaction sent! Please wait for confirmation.");
        const receipt = await tx.wait();

        if (receipt.status === 1) {
            alert("Registration Successful!");
            window.location.href = "index1.html";
        } else {
            throw new Error("Transaction failed on blockchain.");
        }

    } catch (err) {
        console.error("Detailed Error:", err);
        const btn = document.getElementById('reg-btn');
        if(btn) {
            btn.disabled = false;
            btn.innerText = "REGISTER NOW";
        }
        
        let msg = err.reason || err.message || "Unknown error";
        if(msg.includes("user rejected")) msg = "User cancelled the transaction.";
        if(msg.includes("revert")) msg = "Transaction Reverted: Maybe already registered or invalid ref.";
        
        alert("Error: " + msg);
    }
}
window.handleLogout = function() {
    if (confirm("Do you want to disconnect?")) {
        localStorage.setItem('manualLogout', 'true');
        signer = null;
        contract = null;
        const connectBtn = document.getElementById('connect-btn');
        const logoutBtn = document.getElementById('logout-icon-btn');
        if (connectBtn) connectBtn.innerText = "Connect Wallet";
        if (logoutBtn) logoutBtn.classList.add('hidden');
        window.location.href = "index.html";
    }
}

function showLogoutIcon(address) {
    const btn = document.getElementById('connect-btn');
    const logout = document.getElementById('logout-icon-btn');
    if (btn) btn.innerText = address.substring(0, 6) + "..." + address.substring(38);
    if (logout) {
        logout.style.display = 'flex'; 
    }
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
                alert("Please switch to BSC Testnet!");
                return; 
            }
        }
        
        const userData = await contract.users(address);
        const isRegistered = userData.id.gt(0);
        const path = window.location.pathname;

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

window.load3x3Matrix = async function(pkgId, matrixIndex) {
    try {
        const matrix = await contract.getMatrixTree(pkgId, matrixIndex);
        updateText('m-owner', matrix.ownerAddr.substring(0,6));
        updateText('slot-a', matrix.slotA === ethers.constants.AddressZero ? "Empty" : matrix.slotA.substring(0,6));
        updateText('slot-b', matrix.slotB === ethers.constants.AddressZero ? "Empty" : matrix.slotB.substring(0,6));
        updateText('slot-c', matrix.slotC === ethers.constants.AddressZero ? "Empty" : matrix.slotC.substring(0,6));
        updateText('fill-info', `Filled: ${matrix.filledCount}/3`);
    } catch (e) { console.error("Matrix Error", e); }
}

// --- GLOBAL DATA FETCH ---
async function fetchAllData(address) {
    try {
        let activeContract = window.contract || contract;
        const data = await activeContract.getUserTotalData(address);
        
        // 1. User Identity & Wallet
        updateText('wallet-address-display', address.substring(0, 6) + "..." + address.substring(address.length - 4));
        updateText('user-id-display', "ID: #" + data.stats[0].toString());
        
        // 2. Main Stats
        updateText('balance-large', format(data.stats[1])); // Bada balance display
        updateText('total-earned', format(data.stats[2]));
        updateText('income-cap', format(data.stats[3]) + " USDT");
        updateText('direct-count', data.stats[4].toString());

        // 3. Incomes (Matching with Dashboard IDs)
        updateText('direct-earnings', format(data.incomes[0]));
        updateText('level-earnings', format(data.incomes[1]));
        updateText('single-leg-earnings', format(data.incomes[2])); // Single Leg
        updateText('matrix-earnings', format(data.incomes[3]));
        updateText('daily-earnings', format(data.incomes[4]));
        updateText('reward-earnings', format(data.incomes[5]));

        // Booster & Lunar Fund (Abhi logic ke liye Dummy, Contract se aane par format(data.booster) karein)
        updateText('booster-fund', "0.0000"); 
        updateText('lunar-fund', "0.0000");

        // 4. Referral Link Update
        const refUrl = `${window.location.origin}/register.html?ref=${address}`; 
        const refInput = document.getElementById('refURL');
        if(refInput) refInput.value = refUrl;

        // 5. Package Rendering (Live Status)
        // Yahan hum find karenge ki user ka sabse bada active package kaunsa hai
        // Demo: Hum maan rahe hain ki agar user ki matrix income hai toh wo active hai
        // Par sahi tarika hai contract se user ka currentPackageId lena.
        const userPackageData = await activeContract.users(address);
        if (typeof renderPackages === "function") {
            // Hum ek logic bana rahe hain ki user ne kitne package buy kiye hain
            // Agar aapke contract mein 'currentPackageId' field hai toh wahi pass karein
            renderPackages(1); // Yahan contract se aayi value honi chahiye
        }

    } catch (e) { console.error("Fetch Data Error:", e); }
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




