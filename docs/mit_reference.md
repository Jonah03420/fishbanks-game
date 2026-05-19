# Fishbanks – Implementation Reference (MIT Slides)

This document contains all official game rules and formulas from the MIT Fishbanks slides.
Goal: Compare with existing prototype and identify missing/incorrect mechanics.

---

## 1. Game Objective

Net Worth = Bank Balance + Value of Fleet

- Winner = Team with highest Net Worth at game end
- Fleet Value = Number of Ships × current Ship Price (Auction Price)

---

## 2. Annual Profit

Profit ($/year) = Income – Expenses

### 2a. Income

| Item | Formula | Default |
|---|---|---|
| Fish Sales | Catch (fish/year) × Fish Price | Fish Price = $20/fish |
| Ship Sales | Ships Sold × Ship Price | Ship Price = Auction |
| Interest Earnings | Minimum Bank Balance × Interest Rate | Interest Rate = 2%/year |

> Interest is only credited if Minimum Bank Balance is positive.

### 2b. Expenses

| Item | Formula | Default |
|---|---|---|
| Operating Costs | Annual costs for ships in Harbor, Coast & Deep Sea | set by Instructor |
| Ship Purchases | Ships Bought × Ship Price | Ship Price = Auction |
| New Ship Orders | Ships Ordered × New Ship Price | New Ship Price = $300/ship |
| Interest Charges | Minimum Bank Balance × Interest Rate | Interest Rate = 2%/year |

> Interest is only charged if Minimum Bank Balance is negative.

---

## 3. Order of Debits & Credits (CRITICAL)

The sequence within a year is game-decisive.
The Minimum Bank Balance is the LOWEST balance reached during the year - not the final balance!

Step 1: Starting capital (Bank Balance from previous years)
Step 2: - Costs for ship purchases at auction (Ships Bought × Auction Price)
Step 3: - Operating Costs for all deployed ships
Step 4: + Fish sales revenue (Catch × Fish Price)
Step 5: Determine Minimum Balance → credit or charge interest
Step 6: - Costs for new ship orders (Ships Ordered × New Ship Price)
          → ordered ships delivered at START of NEXT year

Important: After each step (2-4), check if current balance is the new minimum.
Interest is based on this minimum, not the final balance.

---

## 4. Fleet (Fishing Fleet)

### Starting Value
Initial Fleet = 3 ships/team (default, can be changed by Instructor)

### Fleet Changes

| Action | Description |
|---|---|
| Purchase | Via auction from other teams |
| New Build | Orderable each year; payment immediate, delivery next year |
| Sale | Via auction to other teams |

### Maximum New Orders per Year

maxNewOrder = ceil(currentFleet / 2)
currentFleet = initialFleet + auctionPurchases (current year)

Round UP to nearest whole number.
Example: Fleet = 5 → max 3 new ships orderable.

### Deployment Zones
Ships can be deployed in three zones:
- Harbor
- Coastal
- Deep Sea

Operating Costs apply to all deployed ships, regardless of zone.

---

## 5. Fish Catch

Catch = Number of Ships × Ship Effectiveness × Weather Factor

### Ship Effectiveness
- Depends NON-LINEARLY on fish density (concave curve - saturation curve)
- More fish in ocean = higher effectiveness per ship
- Maximum effectiveness at full fish density:
  - Deep Sea: ~25 fish/ship/year
  - Coastal: ~15 fish/ship/year

function shipEffectiveness(fishDensity, zone) {
  // fishDensity = currentFish / maxFish (value between 0 and 1)
  const maxEff = zone === 'deepSea' ? 25 : 15;
  return maxEff * Math.sqrt(fishDensity);
}

Core message: When too many teams deploy too many ships, fish density drops,
effectiveness falls, catch decreases - Tragedy of the Commons.

---

## 6. Interest - Complete Logic

function applyInterest(bankBalance, minBalanceDuringYear, interestRate) {
  // interestRate = 0.02 (default)
  // Same formula for credit and charge - sign results automatically
  bankBalance += minBalanceDuringYear * interestRate;
  return bankBalance;
}

- minBalanceDuringYear > 0 → positive amount → credit
- minBalanceDuringYear < 0 → negative amount → charge

---

## 7. Annual Process - Complete Pseudocode

function processYear(team, decisions, gameParams) {
  const { fishPrice, newShipPrice, interestRate, auctionPrice, operatingCostPerShip } = gameParams;

  // Minimum Balance tracking
  let minBalance = team.bankBalance;
  const track = (newBalance) => {
    minBalance = Math.min(minBalance, newBalance);
    return newBalance;
  };

  // Step 2: Auction purchases
  team.fleet += decisions.shipsBought;
  team.bankBalance = track(team.bankBalance - decisions.shipsBought * auctionPrice);

  // Step 3: Operating Costs
  team.bankBalance = track(team.bankBalance - team.fleet * operatingCostPerShip);

  // Step 4: Fish catch & revenue
  const fishDensity = gameState.fish.current / gameState.fish.max;
  const effectiveness = shipEffectiveness(fishDensity, decisions.zone);
  const catch_ = decisions.shipsDeployed * effectiveness * weatherFactor();
  team.bankBalance = track(team.bankBalance + catch_ * fishPrice);

  // Step 5: Interest on Minimum Balance
  team.bankBalance += minBalance * interestRate;

  // Step 6: New ships - pay & schedule for next year
  const maxOrder = Math.ceil(team.fleet / 2);
  const actualOrder = Math.min(decisions.shipsOrdered, maxOrder);
  team.bankBalance -= actualOrder * newShipPrice;
  team.shipsInDelivery = actualOrder; // delivered NEXT year

  // Update fish population (after all teams have fished)
  // → call separately after all team calculations
}

// At start of each new year:
function deliverShips(team) {
  team.fleet += team.shipsInDelivery;
  team.shipsInDelivery = 0;
}

---

## 8. Recommended Data Structure

const gameState = {
  year: 1,
  fish: {
    current: 4000,
    max: 6000,
    growthRate: 0.15
  },
  params: {
    fishPrice: 20,
    newShipPrice: 300,
    interestRate: 0.02,
    initialFleets: 3,
    operatingCostPerShip: 0
  },
  teams: [
    {
      id: 1,
      name: 'Team A',
      bankBalance: 0,
      fleet: 3,
      shipsInDelivery: 0,
      netWorth: 0
    }
  ]
};

---

## 9. Checklist - Prototype Comparison

- [ ] Order of Debits/Credits correctly implemented? (Steps 1-6)
- [ ] Minimum Balance tracked during year (not final balance)?
- [ ] Interest applied to Minimum Balance (not final balance)?
- [ ] New Ships: payment immediate, delivery next year?
- [ ] Max order limit: ceil(fleet / 2) enforced?
- [ ] Ship Effectiveness nonlinear (dependent on fish density)?
- [ ] Two curves: Deep Sea (max 25) vs Coastal (max 15)?
- [ ] Net Worth = Bank Balance + Fleet Value (not just Bank Balance)?
- [ ] Fleet Value based on current auction price?
- [ ] Operating Costs apply to all deployed ships (all zones)?

---

## 10. Instructor-Configurable Parameters (no fixed defaults)

| Parameter | Description |
|---|---|
| Number of Teams | How many teams play |
| Initial Fleet | Ships per team at start (default: 3) |
| Operating Costs | Cost per ship per year |
| Fish Price | Price per fish (default: $20) |
| Interest Rate | Interest on Minimum Balance (default: 2%) |
| New Ship Price | New build price (default: $300) |
| Max Fish Population | Maximum ocean capacity |
| Fish Reproduction | How fast fish regenerate |
| Max New Ship Order | Maximum order per year (default: half of fleet) |

---

Source: MIT Fishbanks Introduction Slides (all default values taken directly from slides)