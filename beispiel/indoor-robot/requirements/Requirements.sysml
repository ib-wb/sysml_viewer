// Sample project indoor robot – requirements
private import ScalarValues::*;

package Requirements {
    private import RequirementDerivation::*;

    requirement def <'R1'> Runtime {
        doc /* The robot drives for at least 2 hours on one battery charge. */
        subject r : Structure::Robot;
        attribute runtime : Real;
        require constraint { runtime >= 2 }
    }
    requirement def <'R2'> ObstacleDetection {
        doc /* Obstacles from a distance of 30 cm are detected in every direction of travel. */
    }
    requirement def <'R2.1'> ScanRate {
        doc /* The lidar delivers at least 10 complete scans per second. */
    }
    requirement def <'R3'> Weight {
        doc /* The total mass of the robot is below 4 kg. */
        attribute totalMass : Real;
        require constraint { totalMass < 4 }
    }
    requirement def <'R4'> EmergencyStop {
        doc /* An emergency stop button halts both drive motors in less than 100 ms. */
    }

    requirement robotRequirements {
        doc /* Requirements for the indoor robot, version 1.0 */
        requirement runtime : Runtime;
        requirement obstacle : ObstacleDetection;
        requirement scanRate : ScanRate;
        requirement weight : Weight;
        requirement emergencyStop : EmergencyStop;
    }

    // The scan rate is derived from obstacle detection
    #derivation connection {
        end #original ::> robotRequirements.obstacle;
        end #derive ::> robotRequirements.scanRate;
    }
}
