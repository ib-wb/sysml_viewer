// Sample project indoor robot – behaviour
private import ScalarValues::*;

package Behaviour {
    item def Pose;
    item def Path;

    state def OperatingStates {
        entry; then Ready;

        state Ready;
        accept StartCommand then Navigation;

        state Navigation {
            entry; then Planning;
            state Planning {
                do action findPath;
            }
            accept PathFound then Driving;
            state Driving {
                do action followPath;
            }
            accept ObstacleDetected then Planning;
        }
        transition goalReached first Navigation accept GoalReached then Ready;
        transition first Navigation accept BatteryLow then Charging;

        state Charging {
            entry action dock;
        }
        transition first Charging accept BatteryFull then Ready;
    }

    action def NavigateToGoal {
        in item goal : Pose;
        out item reached : Boolean;

        first start;
        then action localize {
            out item pose : Pose;
        }
        then action planPath {
            in item pose : Pose;
            in item goal : Pose;
            out item path : Path;
        }
        then action followPath {
            in item path : Path;
        }
        then decide check;
            if goalReached then done;
            else localize;

        flow from goal to planPath.goal;
        flow from localize.pose to planPath.pose;
        flow from planPath.path to followPath.path;
    }
}
