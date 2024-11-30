//
//  Item.swift
//  DayQuest
//
//  Created by Jannik Kugler on 30.11.24.
//

import Foundation
import SwiftData

@Model
final class Item {
    var timestamp: Date
    
    init(timestamp: Date) {
        self.timestamp = timestamp
    }
}
