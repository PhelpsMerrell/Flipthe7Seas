# Card Deck Application

A web-based card deck application for managing a custom 94-card deck with number cards, action cards, and modifier cards.

## Required PNG Assets

Place these PNG files in the `assets/` folder:

### Card Back
- `card_back.png` - Back of cards design

### Number Cards (0-12)
- `card_0.png`
- `card_1.png`
- `card_2.png`
- `card_3.png`
- `card_4.png`
- `card_5.png`
- `card_6.png`
- `card_7.png`
- `card_8.png`
- `card_9.png`
- `card_10.png`
- `card_11.png`
- `card_12.png`

### Modifier Cards
- `card_plus_2.png`
- `card_plus_4.png`
- `card_plus_6.png`
- `card_plus_8.png`
- `card_plus_10.png`
- `card_multiplier_x2.png`

### Action Cards
- `card_flip_three.png`
- `card_freeze.png`
- `card_second_chance.png`

## Deck Composition

The deck consists of exactly 94 cards:

### Number Cards (78 cards)
- Twelve 12's
- Eleven 11's
- Ten 10's
- Nine 9's
- Eight 8's
- Seven 7's
- Six 6's
- Five 5's
- Four 4's
- Three 3's
- Two 2's
- One 1
- One 0

### Action Cards (9 cards)
- Three "Flip Three" cards
- Three "Freeze" cards
- Three "Second Chance" cards

### Modifier Cards (7 cards)
- One +2 card
- One +4 card
- One +6 card
- One +8 card
- One +10 card
- One X2 multiplier card

## Features

- **Draw Cards**: Click "Draw Card" to draw from the deck
- **Rounds**: Cards drawn in a session appear in the current round area
- **End Round**: Move current round cards to the drawn pile
- **Undo**: Undo the last action (draw or end round)
- **Shuffle Options**:
  - Shuffle remaining cards in deck
  - Shuffle all cards back into deck
- **View Drawn Cards**: Click the drawn pile to see all drawn cards fanned out
- **Import/Export**: Save and load game states in JSON format
- **Auto-Reshuffle**: When deck is empty, drawn cards automatically shuffle back in

## Usage

1. Open `index.html` in a web browser
2. The deck is automatically shuffled and ready to use
3. Click "Draw Card" to draw cards into the current round
4. Click "End Round" to move current round cards to drawn pile
5. Use export/import to save game states
6. Click the drawn pile to view all drawn cards

## Hosting as SPA on Azure

This application is designed as a Single Page Application (SPA) and can be directly hosted on Azure Static Web Apps or Azure Blob Storage with static website hosting enabled.

## Mathematical Accuracy

The application maintains mathematical accuracy identical to manipulating a physical deck:
- True random shuffling using Fisher-Yates algorithm
- Proper deck management with automatic reshuffling when empty
- State preservation through undo functionality
- Accurate card counting and tracking
