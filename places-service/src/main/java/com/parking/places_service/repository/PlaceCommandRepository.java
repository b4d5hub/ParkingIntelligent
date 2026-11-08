package com.parking.places_service.repository;

import com.parking.places_service.entity.PlaceCommand;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PlaceCommandRepository extends JpaRepository<PlaceCommand, String> {
}